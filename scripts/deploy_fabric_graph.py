"""Deploy the curated Lakehouse and rendered graph notebook to Fabric."""

from __future__ import annotations

import argparse
import base64
import json
import re
import time
import urllib.error
from pathlib import Path

from fabric_client import FabricClient, FabricError


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_ROOT = ROOT / "fabric" / "nb_build_dataverse_graph.Notebook"


def require(config: dict[str, str], key: str) -> str:
    value = config.get(key, "")
    if not value or value.startswith("<"):
        raise ValueError(f"Set {key} in the deployment configuration.")
    return value


def find_item(
    client: FabricClient, workspace_id: str, item_type: str, display_name: str
) -> dict | None:
    items = client.get(f"workspaces/{workspace_id}/items?type={item_type}")["value"]
    return next((item for item in items if item["displayName"] == display_name), None)


def ensure_lakehouse(client: FabricClient, config: dict[str, str]) -> dict:
    workspace_id = require(config, "workspaceId")
    name = require(config, "curatedLakehouseName")
    existing = find_item(client, workspace_id, "Lakehouse", name)
    if existing:
        return existing
    client.post(
        f"workspaces/{workspace_id}/lakehouses",
        {
            "displayName": name,
            "description": "Curated analytical graph nodes and edges derived from Dataverse.",
        },
    )
    created = find_item(client, workspace_id, "Lakehouse", name)
    if not created:
        raise FabricError(f"Lakehouse creation completed but {name} was not found.")
    return created


def render_notebook(
    config: dict[str, str], mapping: dict, lakehouse_id: str
) -> str:
    content = (NOTEBOOK_ROOT / "notebook-content.py").read_text(encoding="utf-8")
    replacements = {
        "__SOURCE_WORKSPACE_ID__": require(config, "workspaceId"),
        "__SOURCE_LAKEHOUSE_ID__": require(config, "sourceLakehouseId"),
        "__CURATED_WORKSPACE_ID__": require(config, "workspaceId"),
        "__CURATED_LAKEHOUSE_ID__": lakehouse_id,
        "__CURATED_LAKEHOUSE_NAME__": require(config, "curatedLakehouseName"),
        "__GRAPH_MAPPING_JSON__": json.dumps(mapping, separators=(",", ":")),
    }
    for marker, value in replacements.items():
        content = content.replace(marker, value)
    unresolved = sorted(set(re.findall(r"__[A-Z][A-Z0-9_]+__", content)))
    if unresolved:
        raise ValueError(f"Notebook contains unresolved deployment markers: {unresolved}")
    return content


def definition(notebook_content: str) -> dict:
    platform_content = (NOTEBOOK_ROOT / ".platform").read_bytes()
    return {
        "format": "fabricGitSource",
        "parts": [
            {
                "path": "notebook-content.py",
                "payload": base64.b64encode(notebook_content.encode("utf-8")).decode(
                    "ascii"
                ),
                "payloadType": "InlineBase64",
            },
            {
                "path": ".platform",
                "payload": base64.b64encode(platform_content).decode("ascii"),
                "payloadType": "InlineBase64",
            },
        ],
    }


def deploy_notebook(
    client: FabricClient, config: dict[str, str], notebook_definition: dict
) -> dict:
    workspace_id = require(config, "workspaceId")
    name = require(config, "notebookName")
    existing = find_item(client, workspace_id, "Notebook", name)
    if existing:
        client.post(
            f"workspaces/{workspace_id}/notebooks/{existing['id']}/updateDefinition?updateMetadata=true",
            {"definition": notebook_definition},
        )
        return existing
    client.post(
        f"workspaces/{workspace_id}/notebooks",
        {
            "displayName": name,
            "description": "Build configuration-driven graph nodes and edges from linked Dataverse tables.",
            "definition": notebook_definition,
        },
    )
    created = find_item(client, workspace_id, "Notebook", name)
    if not created:
        raise FabricError(f"Notebook creation completed but {name} was not found.")
    return created


def run_notebook(client: FabricClient, workspace_id: str, notebook_id: str) -> dict:
    status, headers, _ = client.request(
        "POST",
        f"workspaces/{workspace_id}/items/{notebook_id}/jobs/RunNotebook/instances",
    )
    if status != 202:
        raise FabricError(f"Notebook execution returned unexpected status {status}.")
    location = headers.get("Location") or headers.get("location")
    delay = int(headers.get("Retry-After") or headers.get("retry-after") or 30)
    deadline = time.monotonic() + 7200
    while True:
        if time.monotonic() >= deadline:
            raise FabricError("Notebook execution did not finish within two hours.")
        time.sleep(max(delay, 1))
        try:
            status, response_headers, job = client.request("GET", location)
        except (urllib.error.URLError, TimeoutError):
            delay = min(max(delay, 5) * 2, 60)
            continue
        if status != 200 or not isinstance(job, dict):
            raise FabricError(f"Notebook job status returned {status}: {job}")
        if job["status"] in {"Completed", "Failed", "Cancelled", "Deduped"}:
            if job["status"] != "Completed":
                raise FabricError(f"Notebook job did not complete successfully: {job}")
            return job
        delay = int(
            response_headers.get("Retry-After")
            or response_headers.get("retry-after")
            or 30
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config", default=str(ROOT / "config" / "deployment.example.json")
    )
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    mapping = json.loads(
        (ROOT / "config" / "graph-mapping.json").read_text(encoding="utf-8")
    )
    client = FabricClient()
    lakehouse = ensure_lakehouse(client, config)
    notebook_content = render_notebook(config, mapping, lakehouse["id"])
    notebook = deploy_notebook(client, config, definition(notebook_content))
    print(
        json.dumps(
            {
                "workspaceId": config["workspaceId"],
                "lakehouseId": lakehouse["id"],
                "notebookId": notebook["id"],
            }
        )
    )
    if args.run:
        print(json.dumps(run_notebook(client, config["workspaceId"], notebook["id"])))


if __name__ == "__main__":
    main()
