"""Create or update a visual Fabric Graph Model over the curated graph tables."""

from __future__ import annotations

import argparse
import base64
import json
import re
from pathlib import Path
from typing import Any

from fabric_client import FabricClient, FabricError


ROOT = Path(__file__).resolve().parents[1]
MAPPING_PATH = ROOT / "config" / "graph-mapping.json"

NODE_PROPERTIES = [
    ("nodeId", "node_id", "STRING"),
    ("label", "label", "STRING"),
    ("businessKey", "business_key", "STRING"),
    ("propertiesJson", "properties_json", "STRING"),
    ("sourceRecordId", "source_record_id", "STRING"),
    ("sourceModifiedAt", "source_modified_at", "DATETIME"),
    ("mappingVersion", "mapping_version", "STRING"),
    ("runId", "run_id", "STRING"),
    ("curatedAt", "curated_at", "DATETIME"),
]

EDGE_PROPERTIES = [
    ("edgeId", "edge_id", "STRING"),
    ("sourceRecordId", "source_record_id", "STRING"),
    ("propertiesJson", "properties_json", "STRING"),
    ("sourceModifiedAt", "source_modified_at", "DATETIME"),
    ("mappingVersion", "mapping_version", "STRING"),
    ("runId", "run_id", "STRING"),
    ("curatedAt", "curated_at", "DATETIME"),
]


def schema_url(part: str, version: str = "1.0.0") -> str:
    return (
        "https://developer.microsoft.com/json-schemas/fabric/item/"
        f"graphIndex/definition/{part}/{version}/schema.json"
    )


def alias(value: str, suffix: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_]", "_", value)
    return f"{normalized}_{suffix}"


def graph_table_name(kind: str, value: str) -> str:
    suffix = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return f"graph_{kind}_{suffix}"


def property_definitions(properties: list[tuple[str, str, str]]) -> list[dict[str, str]]:
    return [{"name": name, "type": data_type} for name, _, data_type in properties]


def property_mappings(properties: list[tuple[str, str, str]]) -> list[dict[str, str]]:
    return [
        {"propertyName": name, "sourceColumn": source}
        for name, source, _ in properties
    ]


def build_parts(
    workspace_id: str,
    lakehouse_id: str,
    graph_name: str,
    mapping: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    table_root = (
        f"abfss://{workspace_id}@onelake.dfs.fabric.microsoft.com/"
        f"{lakehouse_id}/Tables"
    )
    node_types = []
    node_tables = []
    data_sources = []
    positions: dict[str, dict[str, int]] = {}
    styles: dict[str, dict[str, int]] = {}

    for index, node in enumerate(mapping["nodeTypes"]):
        node_alias = alias(node["type"], "nodeType")
        data_source_name = alias(node["type"], "Node_Table")
        data_sources.append(
            {
                "name": data_source_name,
                "type": "DeltaTable",
                "properties": {
                    "path": f"{table_root}/{graph_table_name('node', node['type'])}"
                },
            }
        )
        node_types.append(
            {
                "alias": node_alias,
                "labels": [node["type"]],
                "primaryKeyProperties": ["nodeId"],
                "properties": property_definitions(NODE_PROPERTIES),
            }
        )
        node_tables.append(
            {
                "id": alias(node["type"], "nodeTable"),
                "nodeTypeAlias": node_alias,
                "dataSourceName": data_source_name,
                "propertyMappings": property_mappings(NODE_PROPERTIES),
            }
        )
        positions[node_alias] = {"x": (index % 4) * 300, "y": (index // 4) * 260}
        styles[node_alias] = {"size": 30}

    edge_types = []
    edge_tables = []
    for relationship in mapping["relationships"]:
        edge_alias = alias(relationship["id"], "edgeType")
        data_source_name = alias(relationship["id"], "Edge_Table")
        data_sources.append(
            {
                "name": data_source_name,
                "type": "DeltaTable",
                "properties": {
                    "path": (
                        f"{table_root}/"
                        f"{graph_table_name('edge', relationship['id'])}"
                    )
                },
            }
        )
        edge_types.append(
            {
                "alias": edge_alias,
                "labels": [relationship["type"]],
                "sourceNodeType": {
                    "alias": alias(relationship["sourceType"], "nodeType")
                },
                "destinationNodeType": {
                    "alias": alias(relationship["targetType"], "nodeType")
                },
                "properties": property_definitions(EDGE_PROPERTIES),
            }
        )
        edge_tables.append(
            {
                "id": alias(relationship["id"], "edgeTable"),
                "edgeTypeAlias": edge_alias,
                "dataSourceName": data_source_name,
                "sourceNodeKeyColumns": ["source_node_id"],
                "destinationNodeKeyColumns": ["target_node_id"],
                "propertyMappings": property_mappings(EDGE_PROPERTIES),
            }
        )
        styles[edge_alias] = {"size": 20}

    return {
        "graphType.json": {
            "$schema": schema_url("graphType"),
            "nodeTypes": node_types,
            "edgeTypes": edge_types,
        },
        "dataSources.json": {
            "$schema": schema_url("dataSources"),
            "dataSources": data_sources,
        },
        "graphDefinition.json": {
            "$schema": schema_url("graphDefinition"),
            "nodeTables": node_tables,
            "edgeTables": edge_tables,
        },
        "stylingConfiguration.json": {
            "$schema": schema_url("stylingConfiguration"),
            "modelLayout": {
                "positions": positions,
                "styles": styles,
                "pan": {"x": 0, "y": 0},
                "zoomLevel": 1,
            },
            "visualFormat": None,
        },
        "graphSettings.json": {
            "$schema": schema_url("graphSettings"),
        },
        ".platform": {
            "$schema": (
                "https://developer.microsoft.com/json-schemas/fabric/"
                "gitIntegration/platformProperties/2.0.0/schema.json"
            ),
            "metadata": {
                "type": "GraphModel",
                "displayName": graph_name,
                "description": (
                    "Visual property graph built from curated Dataverse "
                    "node and edge tables."
                ),
            },
            "config": {
                "version": "2.0",
                "logicalId": "00000000-0000-0000-0000-000000000000",
            },
        },
    }


def public_definition(parts: dict[str, dict[str, Any]]) -> dict[str, Any]:
    encoded_parts = []
    for path, value in parts.items():
        payload = json.dumps(value, separators=(",", ":")).encode("utf-8")
        encoded_parts.append(
            {
                "path": path,
                "payload": base64.b64encode(payload).decode("ascii"),
                "payloadType": "InlineBase64",
            }
        )
    return {"format": "json", "parts": encoded_parts}


def find_graph(
    client: FabricClient, workspace_id: str, display_name: str
) -> dict[str, Any] | None:
    items = client.get(f"workspaces/{workspace_id}/items?type=GraphModel")["value"]
    return next((item for item in items if item["displayName"] == display_name), None)


def deploy(
    client: FabricClient,
    workspace_id: str,
    lakehouse_id: str,
    graph_name: str,
) -> dict[str, Any]:
    graph = find_graph(client, workspace_id, graph_name)
    if graph is None:
        client.post(
            f"workspaces/{workspace_id}/graphModels",
            {
                "displayName": graph_name,
                "description": (
                    "Visual property graph built from curated Dataverse "
                    "node and edge tables."
                ),
            },
        )
        graph = find_graph(client, workspace_id, graph_name)
    if graph is None:
        raise FabricError(f"Graph Model creation completed but {graph_name} was not found.")

    mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
    definition = public_definition(
        build_parts(workspace_id, lakehouse_id, graph_name, mapping)
    )
    client.post(
        (
            f"workspaces/{workspace_id}/graphModels/{graph['id']}/"
            "updateDefinition?updateMetadata=true"
        ),
        {"definition": definition},
    )
    return graph


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--lakehouse-id", required=True)
    parser.add_argument("--name", default="gm_d365_relationships")
    args = parser.parse_args()

    graph = deploy(
        FabricClient(),
        args.workspace_id,
        args.lakehouse_id,
        args.name,
    )
    print(
        json.dumps(
            {
                "workspaceId": args.workspace_id,
                "lakehouseId": args.lakehouse_id,
                "graphModelId": graph["id"],
                "graphModelName": graph["displayName"],
            }
        )
    )


if __name__ == "__main__":
    main()
