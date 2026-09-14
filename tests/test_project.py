import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ProjectDefinitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads(
            (ROOT / "schema" / "dataverse-schema.json").read_text(encoding="utf-8")
        )
        cls.data = json.loads(
            (ROOT / "data" / "demo-data.json").read_text(encoding="utf-8")
        )
        cls.mapping = json.loads(
            (ROOT / "config" / "graph-mapping.json").read_text(encoding="utf-8")
        )

    def test_custom_names_use_publisher_prefix(self) -> None:
        prefix = f"{self.schema['publisher']['prefix']}_"
        for table in self.schema["tables"]:
            self.assertTrue(table["logicalName"].startswith(prefix))
            self.assertTrue(table["entitySetName"].startswith(prefix))
            for column in table["columns"]:
                self.assertTrue(column["schemaName"].lower().startswith(prefix))

    def test_table_and_entity_set_names_are_unique(self) -> None:
        logical_names = [table["logicalName"] for table in self.schema["tables"]]
        entity_sets = [table["entitySetName"] for table in self.schema["tables"]]
        self.assertEqual(len(logical_names), len(set(logical_names)))
        self.assertEqual(len(entity_sets), len(set(entity_sets)))

    def test_relationship_entities_exist(self) -> None:
        entities = {"account", "contact"} | {
            table["logicalName"] for table in self.schema["tables"]
        }
        for relationship in self.schema["relationships"]:
            self.assertIn(relationship["referencedEntity"], entities)
            self.assertIn(relationship["referencingEntity"], entities)

    def test_seed_keys_are_unique_per_record_set(self) -> None:
        for record_set in self.data["recordSets"]:
            keys = [record["key"] for record in record_set["records"]]
            self.assertEqual(len(keys), len(set(keys)), record_set["logicalName"])

    def test_all_lookup_targets_exist(self) -> None:
        available = {
            (record_set["entitySetName"], record_set["keyField"], record["key"])
            for record_set in self.data["recordSets"]
            for record in record_set["records"]
        }
        for record_set in self.data["recordSets"]:
            for record in record_set["records"]:
                for lookup in record.get("lookups", []):
                    target = (
                        lookup["targetSet"],
                        lookup["targetKeyField"],
                        lookup["targetKey"],
                    )
                    self.assertIn(target, available)

    def test_graph_view_is_self_contained(self) -> None:
        graph = (ROOT / "webresources" / "dfd_graphviewer.html").read_text(
            encoding="utf-8"
        )
        self.assertIn("/api/data/v9.2/", graph)
        self.assertNotIn("<script src=", graph.lower())
        self.assertNotIn("<link rel=\"stylesheet\"", graph.lower())

    def test_graph_mapping_relationship_types_are_resolvable(self) -> None:
        node_types = {node["type"] for node in self.mapping["nodeTypes"]}
        for relationship in self.mapping["relationships"]:
            self.assertIn(relationship["sourceType"], node_types)
            self.assertIn(relationship["targetType"], node_types)

    def test_graph_relationship_identity_is_explicit(self) -> None:
        relationship_ids = [
            relationship["id"] for relationship in self.mapping["relationships"]
        ]
        self.assertEqual(len(relationship_ids), len(set(relationship_ids)))
        for relationship in self.mapping["relationships"]:
            self.assertTrue(relationship["rowIdColumns"])

    def test_filtered_node_tables_filter_relationship_rows(self) -> None:
        table_filters = {
            node["table"]: node["where"]
            for node in self.mapping["nodeTypes"]
            if node.get("where")
        }
        for relationship in self.mapping["relationships"]:
            if relationship["table"] in table_filters:
                self.assertEqual(
                    relationship.get("where"),
                    table_filters[relationship["table"]],
                )

    def test_graph_mapping_tables_exist_in_seed_contract(self) -> None:
        seeded_tables = {
            record_set["logicalName"] for record_set in self.data["recordSets"]
        }
        for node in self.mapping["nodeTypes"]:
            self.assertIn(node["table"], seeded_tables)
        for relationship in self.mapping["relationships"]:
            self.assertIn(relationship["table"], seeded_tables)


if __name__ == "__main__":
    unittest.main()
