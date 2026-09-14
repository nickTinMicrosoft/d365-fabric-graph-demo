"""Create the Dataverse solution, custom tables, columns, and relationships."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from dataverse_client import DataverseClient


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schema" / "dataverse-schema.json"
LANGUAGE_CODE = 1033


def label(text: str) -> dict[str, Any]:
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.Label",
        "LocalizedLabels": [
            {
                "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                "Label": text,
                "LanguageCode": LANGUAGE_CODE,
            }
        ],
    }


def required_level(required: bool = False) -> dict[str, Any]:
    return {
        "Value": "ApplicationRequired" if required else "None",
        "CanBeChanged": True,
    }


def string_attribute(
    schema_name: str,
    display_name: str,
    max_length: int,
    required: bool = False,
    primary: bool = False,
) -> dict[str, Any]:
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        "SchemaName": schema_name,
        "DisplayName": label(display_name),
        "RequiredLevel": required_level(required),
        "MaxLength": max_length,
        "FormatName": {"Value": "Text"},
        "IsPrimaryName": primary,
    }


def attribute(column: dict[str, Any]) -> dict[str, Any]:
    common = {
        "SchemaName": column["schemaName"],
        "DisplayName": label(column["displayName"]),
        "RequiredLevel": required_level(column.get("required", False)),
    }
    column_type = column["type"]
    if column_type == "String":
        return string_attribute(
            column["schemaName"],
            column["displayName"],
            column.get("maxLength", 200),
            column.get("required", False),
        )
    if column_type == "Integer":
        return {
            "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
            **common,
            "Format": "None",
            "MinValue": -2147483648,
            "MaxValue": 2147483647,
        }
    if column_type == "Decimal":
        return {
            "@odata.type": "Microsoft.Dynamics.CRM.DecimalAttributeMetadata",
            **common,
            "Precision": column.get("precision", 2),
            "MinValue": -100000000000,
            "MaxValue": 100000000000,
        }
    if column_type == "Date":
        return {
            "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
            **common,
            "Format": "DateOnly",
            "DateTimeBehavior": {"Value": "DateOnly"},
        }
    raise ValueError(f"Unsupported column type: {column_type}")


def ensure_publisher(client: DataverseClient, publisher: dict[str, Any]) -> str:
    result = client.get(
        "publishers",
        {
            "$select": "publisherid",
            "$filter": f"uniquename eq '{publisher['uniqueName']}'",
        },
    )
    if result["value"]:
        return result["value"][0]["publisherid"]
    created = client.post(
        "publishers",
        {
            "uniquename": publisher["uniqueName"],
            "friendlyname": publisher["friendlyName"],
            "customizationprefix": publisher["prefix"],
            "customizationoptionvalueprefix": publisher["optionValuePrefix"],
        },
    )
    entity_id = created.get("headers", {}).get("OData-EntityId", "")
    if not entity_id:
        result = client.get(
            "publishers",
            {
                "$select": "publisherid",
                "$filter": f"uniquename eq '{publisher['uniqueName']}'",
            },
        )
        return result["value"][0]["publisherid"]
    return entity_id.rsplit("(", 1)[-1].rstrip(")")


def ensure_solution(
    client: DataverseClient, solution: dict[str, Any], publisher_id: str
) -> None:
    result = client.get(
        "solutions",
        {
            "$select": "solutionid",
            "$filter": f"uniquename eq '{solution['uniqueName']}'",
        },
    )
    if result["value"]:
        print(f"Solution already exists: {solution['uniqueName']}")
        return
    client.post(
        "solutions",
        {
            "uniquename": solution["uniqueName"],
            "friendlyname": solution["friendlyName"],
            "version": solution["version"],
            "publisherid@odata.bind": f"/publishers({publisher_id})",
        },
    )
    print(f"Created solution: {solution['uniqueName']}")


def ensure_table(
    client: DataverseClient, table: dict[str, Any], solution_name: str
) -> None:
    result = client.get(
        "EntityDefinitions",
        {
            "$select": "LogicalName,ChangeTrackingEnabled",
            "$filter": f"LogicalName eq '{table['logicalName']}'",
        },
    )
    if result["value"]:
        if not result["value"][0]["ChangeTrackingEnabled"]:
            path = f"EntityDefinitions(LogicalName='{table['logicalName']}')"
            metadata = client.get(path)
            metadata["ChangeTrackingEnabled"] = True
            client.put(
                path,
                metadata,
                {
                    "MSCRM.MergeLabels": "true",
                    "MSCRM.SolutionUniqueName": solution_name,
                },
            )
            print(f"Enabled change tracking: {table['logicalName']}")
        print(f"Table already exists: {table['logicalName']}")
        return

    primary_name = table["primaryName"]
    payload = {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        "SchemaName": table["schemaName"],
        "EntitySetName": table["entitySetName"],
        "DisplayName": label(table["displayName"]),
        "DisplayCollectionName": label(table["displayCollectionName"]),
        "Description": label("Synthetic table for the D365 Fabric graph demonstration."),
        "OwnershipType": "UserOwned",
        "IsActivity": False,
        "HasActivities": False,
        "HasNotes": True,
        "ChangeTrackingEnabled": True,
        "Attributes": [
            string_attribute(
                primary_name["schemaName"],
                primary_name["displayName"],
                primary_name["maxLength"],
                required=True,
                primary=True,
            ),
            *[attribute(column) for column in table["columns"]],
        ],
    }
    client.post(
        "EntityDefinitions",
        payload,
        {"MSCRM.SolutionUniqueName": solution_name},
    )
    print(f"Created table: {table['logicalName']}")


def ensure_relationship(
    client: DataverseClient, relationship: dict[str, Any], solution_name: str
) -> None:
    result = client.get(
        "RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
        {
            "$select": "SchemaName",
            "$filter": f"SchemaName eq '{relationship['schemaName']}'",
        },
    )
    if result["value"]:
        print(f"Relationship already exists: {relationship['schemaName']}")
        return

    payload = {
        "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
        "SchemaName": relationship["schemaName"],
        "ReferencedEntity": relationship["referencedEntity"],
        "ReferencingEntity": relationship["referencingEntity"],
        "ReferencingEntityNavigationPropertyName": relationship["navigationProperty"],
        "AssociatedMenuConfiguration": {
            "Behavior": "UseCollectionName",
            "Group": "Details",
            "Order": 10000,
        },
        "CascadeConfiguration": {
            "Assign": "NoCascade",
            "Delete": "RemoveLink",
            "Merge": "NoCascade",
            "Reparent": "NoCascade",
            "Share": "NoCascade",
            "Unshare": "NoCascade",
        },
        "Lookup": {
            "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
            "SchemaName": relationship["lookupSchemaName"],
            "DisplayName": label(relationship["lookupDisplayName"]),
            "RequiredLevel": required_level(),
        },
    }
    client.post(
        "RelationshipDefinitions",
        payload,
        {"MSCRM.SolutionUniqueName": solution_name},
    )
    print(f"Created relationship: {relationship['schemaName']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment-url", required=True)
    args = parser.parse_args()

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    client = DataverseClient(args.environment_url)
    publisher_id = ensure_publisher(client, schema["publisher"])
    ensure_solution(client, schema["solution"], publisher_id)

    solution_name = schema["solution"]["uniqueName"]
    for table in schema["tables"]:
        ensure_table(client, table, solution_name)
    for relationship in schema["relationships"]:
        ensure_relationship(client, relationship, solution_name)

    client.post("PublishAllXml", {})
    print("Published all customizations.")


if __name__ == "__main__":
    main()
