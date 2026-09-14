"""Idempotently load synthetic business records into Dataverse."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from dataverse_client import DataverseClient


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "demo-data.json"


def escape_odata_string(value: str) -> str:
    return value.replace("'", "''")


def find_record_id(
    client: DataverseClient,
    entity_set: str,
    key_field: str,
    key_value: str,
) -> str | None:
    primary_id = (
        f"{entity_set[:-3]}yid"
        if entity_set.endswith("ies")
        else f"{entity_set[:-1]}id"
    )
    result = client.get(
        entity_set,
        {
            "$select": primary_id,
            "$filter": f"{key_field} eq '{escape_odata_string(key_value)}'",
            "$top": "1",
        },
    )
    if not result["value"]:
        return None
    return result["value"][0][primary_id]


def build_payload(
    client: DataverseClient,
    record_set: dict[str, Any],
    record: dict[str, Any],
) -> dict[str, Any]:
    payload = dict(record.get("fields", {}))
    payload[record_set["keyField"]] = record["key"]
    for lookup in record.get("lookups", []):
        target_id = find_record_id(
            client,
            lookup["targetSet"],
            lookup["targetKeyField"],
            lookup["targetKey"],
        )
        if not target_id:
            raise RuntimeError(
                f"Lookup target not found: {lookup['targetSet']} "
                f"{lookup['targetKeyField']}={lookup['targetKey']}"
            )
        payload[f"{lookup['property']}@odata.bind"] = (
            f"/{lookup['targetSet']}({target_id})"
        )
    return payload


def upsert_record(
    client: DataverseClient,
    record_set: dict[str, Any],
    record: dict[str, Any],
) -> None:
    entity_set = record_set["entitySetName"]
    key_field = record_set["keyField"]
    existing_id = find_record_id(client, entity_set, key_field, record["key"])
    payload = build_payload(client, record_set, record)
    if existing_id:
        client.patch(f"{entity_set}({existing_id})", payload)
        print(f"Updated {record_set['logicalName']}: {record['key']}")
    else:
        client.post(entity_set, payload)
        print(f"Created {record_set['logicalName']}: {record['key']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment-url", required=True)
    args = parser.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    client = DataverseClient(args.environment_url)
    for record_set in data["recordSets"]:
        for record in record_set["records"]:
            upsert_record(client, record_set, record)

    print("Synthetic D365 demo data is ready.")


if __name__ == "__main__":
    main()
