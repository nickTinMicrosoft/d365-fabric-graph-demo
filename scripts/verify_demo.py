"""Verify that every synthetic record and relationship exists in Dataverse."""

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


def primary_id_for(entity_set: str) -> str:
    return f"{entity_set[:-1]}id"


def lookup_value_field(property_name: str) -> str:
    if property_name == "parentcustomerid_account":
        return "_parentcustomerid_value"
    return f"_{property_name}_value"


def find_record(
    client: DataverseClient,
    entity_set: str,
    key_field: str,
    key_value: str,
    extra_fields: list[str] | None = None,
) -> dict[str, Any] | None:
    fields = [primary_id_for(entity_set), *(extra_fields or [])]
    result = client.get(
        entity_set,
        {
            "$select": ",".join(fields),
            "$filter": f"{key_field} eq '{escape_odata_string(key_value)}'",
            "$top": "1",
        },
    )
    return result["value"][0] if result["value"] else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment-url", required=True)
    args = parser.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    client = DataverseClient(args.environment_url)
    verified_records = 0
    verified_lookups = 0

    for record_set in data["recordSets"]:
        for record in record_set["records"]:
            lookup_fields = [
                lookup_value_field(lookup["property"])
                for lookup in record.get("lookups", [])
            ]
            actual = find_record(
                client,
                record_set["entitySetName"],
                record_set["keyField"],
                record["key"],
                lookup_fields,
            )
            if not actual:
                raise RuntimeError(
                    f"Missing {record_set['logicalName']} record: {record['key']}"
                )
            verified_records += 1

            for lookup in record.get("lookups", []):
                target = find_record(
                    client,
                    lookup["targetSet"],
                    lookup["targetKeyField"],
                    lookup["targetKey"],
                )
                if not target:
                    raise RuntimeError(
                        f"Missing lookup target {lookup['targetSet']}: "
                        f"{lookup['targetKey']}"
                    )
                actual_id = actual.get(lookup_value_field(lookup["property"]))
                expected_id = target[primary_id_for(lookup["targetSet"])]
                if not actual_id or actual_id.lower() != expected_id.lower():
                    raise RuntimeError(
                        f"Incorrect lookup on {record['key']}: {lookup['property']}"
                    )
                verified_lookups += 1

    print(
        f"Verified {verified_records} synthetic records and "
        f"{verified_lookups} relationship links."
    )


if __name__ == "__main__":
    main()
