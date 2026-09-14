"""Create or update the Dataverse graph viewer web resource."""

from __future__ import annotations

import argparse
import base64
from pathlib import Path

from dataverse_client import DataverseClient


ROOT = Path(__file__).resolve().parents[1]
WEB_RESOURCE_PATH = ROOT / "webresources" / "dfd_graphviewer.html"
WEB_RESOURCE_NAME = "dfd_graphviewer.html"
SOLUTION_NAME = "D365FabricGraphDemo"


def find_web_resource(client: DataverseClient) -> str | None:
    result = client.get(
        "webresourceset",
        {
            "$select": "webresourceid",
            "$filter": f"name eq '{WEB_RESOURCE_NAME}'",
            "$top": "1",
        },
    )
    return result["value"][0]["webresourceid"] if result["value"] else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment-url", required=True)
    args = parser.parse_args()

    client = DataverseClient(args.environment_url)
    content = base64.b64encode(WEB_RESOURCE_PATH.read_bytes()).decode("ascii")
    payload = {
        "name": WEB_RESOURCE_NAME,
        "displayname": "D365 Relationship Graph",
        "description": "Interactive graph of the synthetic Dataverse relationship demo.",
        "webresourcetype": 1,
        "content": content,
        "introducedversion": "1.0.0.0",
    }

    web_resource_id = find_web_resource(client)
    if web_resource_id:
        client.patch(f"webresourceset({web_resource_id})", payload)
        print(f"Updated web resource: {WEB_RESOURCE_NAME}")
    else:
        client.post(
            "webresourceset",
            payload,
            {"MSCRM.SolutionUniqueName": SOLUTION_NAME},
        )
        web_resource_id = find_web_resource(client)
        if not web_resource_id:
            raise RuntimeError("Dataverse created the web resource but did not return it.")
        print(f"Created web resource: {WEB_RESOURCE_NAME}")

    client.post(
        "PublishXml",
        {
            "ParameterXml": (
                "<importexportxml><webresources>"
                f"<webresource>{web_resource_id}</webresource>"
                "</webresources></importexportxml>"
            )
        },
    )
    print(f"Published graph view: {args.environment_url.rstrip('/')}/WebResources/{WEB_RESOURCE_NAME}")


if __name__ == "__main__":
    main()
