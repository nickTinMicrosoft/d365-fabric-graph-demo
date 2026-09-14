# Fabric notebook source

# METADATA ********************

# META {
# META   "kernel_info": {
# META     "name": "synapse_pyspark"
# META   },
# META   "dependencies": {
# META     "lakehouse": {
# META       "default_lakehouse": "__CURATED_LAKEHOUSE_ID__",
# META       "default_lakehouse_name": "__CURATED_LAKEHOUSE_NAME__",
# META       "default_lakehouse_workspace_id": "__CURATED_WORKSPACE_ID__",
# META       "known_lakehouses": [
# META         {
# META           "id": "__CURATED_LAKEHOUSE_ID__"
# META         }
# META       ]
# META     }
# META   }
# META }

# MARKDOWN ********************

# # Build the Dataverse analytical graph
#
# This notebook reads linked Dataverse Delta tables from a landing Lakehouse and
# writes a separate curated `graph_nodes` and `graph_edges` model. Source mappings
# are configuration-driven so an implementation can substitute its own standard
# and custom Dynamics 365 entities without rewriting the transformation engine.

# PARAMETERS CELL ********************

SOURCE_WORKSPACE_ID = "__SOURCE_WORKSPACE_ID__"
SOURCE_LAKEHOUSE_ID = "__SOURCE_LAKEHOUSE_ID__"
GRAPH_MAPPING_JSON = r'''__GRAPH_MAPPING_JSON__'''

# CELL ********************

import json
import uuid
from datetime import datetime, timezone
from functools import reduce

from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType, TimestampType

if not SOURCE_WORKSPACE_ID or SOURCE_WORKSPACE_ID.startswith("__"):
    raise ValueError("SOURCE_WORKSPACE_ID must identify the workspace containing the Dataverse-generated Lakehouse.")
if not SOURCE_LAKEHOUSE_ID or SOURCE_LAKEHOUSE_ID.startswith("__"):
    raise ValueError("SOURCE_LAKEHOUSE_ID must identify the Dataverse-generated Lakehouse.")

mapping = json.loads(GRAPH_MAPPING_JSON)
run_id = str(uuid.uuid4())
curated_at = datetime.now(timezone.utc)
source_root = (
    f"abfss://{SOURCE_WORKSPACE_ID}@onelake.dfs.fabric.microsoft.com/"
    f"{SOURCE_LAKEHOUSE_ID}/Tables"
)

# CELL ********************

def load_table(table_name: str) -> DataFrame:
    return spark.read.format("delta").load(f"{source_root}/{table_name}")


def resolve_column(frame: DataFrame, candidates: list[str]) -> str:
    by_lower = {column.lower(): column for column in frame.columns}
    for candidate in candidates:
        if candidate.lower() in by_lower:
            return by_lower[candidate.lower()]
    raise ValueError(
        f"None of {candidates} exist in the source table. Available columns: {frame.columns}"
    )


def optional_column(frame: DataFrame, candidates: list[str]):
    try:
        return F.col(resolve_column(frame, candidates))
    except ValueError:
        return F.lit(None)


def normalized_id(frame: DataFrame, candidates: list[str]):
    return F.lower(
        F.regexp_replace(F.trim(F.col(resolve_column(frame, candidates))), "[{}]", "")
    )


def properties_json(frame: DataFrame, properties: dict[str, list[str]]):
    values = []
    for property_name, candidates in properties.items():
        try:
            values.append(F.col(resolve_column(frame, candidates)).alias(property_name))
        except ValueError:
            continue
    return F.to_json(F.struct(*values)) if values else F.lit("{}")


def source_modified_at(frame: DataFrame):
    for candidate in ("modifiedon", "createdon"):
        if candidate in {column.lower() for column in frame.columns}:
            return F.col(resolve_column(frame, [candidate])).cast("timestamp")
    return F.lit(None).cast("timestamp")


def source_version(frame: DataFrame):
    return optional_column(frame, ["versionnumber"]).cast("long")


def assert_unique(frame: DataFrame, key: str, label: str) -> None:
    duplicates = frame.groupBy(key).count().where(F.col("count") > 1)
    if duplicates.limit(1).count():
        sample = [row[key] for row in duplicates.select(key).limit(10).collect()]
        raise ValueError(f"{label} contains duplicate {key} values. Sample: {sample}")

# CELL ********************

node_frames = []
for node_map in mapping["nodeTypes"]:
    source = load_table(node_map["table"])
    if node_map.get("where"):
        source = source.where(node_map["where"])

    record_id = normalized_id(source, node_map["idColumns"])
    node_frames.append(
        source.select(
            F.concat(F.lit(f"{node_map['type']}:"), record_id).alias("node_id"),
            F.lit(node_map["type"]).alias("node_type"),
            optional_column(source, node_map["labelColumns"]).cast("string").alias("label"),
            optional_column(source, node_map["businessKeyColumns"]).cast("string").alias("business_key"),
            properties_json(source, node_map.get("properties", {})).alias("properties_json"),
            F.lit(node_map["table"]).alias("source_table"),
            record_id.alias("source_record_id"),
            source_modified_at(source).alias("source_modified_at"),
            source_version(source).alias("source_version"),
            F.lit(mapping["version"]).alias("mapping_version"),
            F.lit(run_id).alias("run_id"),
            F.lit(curated_at).cast("timestamp").alias("curated_at"),
        )
    )

nodes = reduce(DataFrame.unionByName, node_frames)

# CELL ********************

edge_frames = []
for edge_map in mapping["relationships"]:
    source = load_table(edge_map["table"])
    if edge_map.get("where"):
        source = source.where(edge_map["where"])

    source_row_id = normalized_id(source, edge_map["rowIdColumns"])
    source_record_id = normalized_id(source, edge_map["sourceColumns"])
    target_record_id = normalized_id(source, edge_map["targetColumns"])
    source_node_id = F.concat(F.lit(f"{edge_map['sourceType']}:"), source_record_id)
    target_node_id = F.concat(F.lit(f"{edge_map['targetType']}:"), target_record_id)

    edge_frames.append(
        source.select(
            F.sha2(
                F.concat_ws(
                    "|",
                    F.lit(edge_map["id"]),
                    F.lit(edge_map["table"]),
                    source_row_id,
                    source_node_id,
                    target_node_id,
                ),
                256,
            ).alias("edge_id"),
            source_node_id.alias("source_node_id"),
            target_node_id.alias("target_node_id"),
            F.lit(edge_map["type"]).alias("relationship_type"),
            F.lit(edge_map["table"]).alias("source_table"),
            source_row_id.alias("source_record_id"),
            F.lit("{}").alias("properties_json"),
            source_modified_at(source).alias("source_modified_at"),
            source_version(source).alias("source_version"),
            F.lit(mapping["version"]).alias("mapping_version"),
            F.lit(run_id).alias("run_id"),
            F.lit(curated_at).cast("timestamp").alias("curated_at"),
        ).where(source_record_id.isNotNull() & target_record_id.isNotNull())
    )

edges = reduce(DataFrame.unionByName, edge_frames)

# CELL ********************

guid_pattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
typed_guid_pattern = (
    "^[^:]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-"
    "[0-9a-f]{4}-[0-9a-f]{12}$"
)
if nodes.where(
    F.col("source_record_id").isNull()
    | ~F.col("source_record_id").rlike(guid_pattern)
).limit(1).count():
    raise ValueError("Node generation produced a null or malformed source GUID.")
if edges.where(
    F.col("source_record_id").isNull()
    | ~F.col("source_record_id").rlike(guid_pattern)
).limit(1).count():
    raise ValueError("Edge generation produced a null or malformed source-row GUID.")
if edges.where(
    ~F.col("source_node_id").rlike(typed_guid_pattern)
    | ~F.col("target_node_id").rlike(typed_guid_pattern)
).limit(1).count():
    raise ValueError("Edge generation produced a malformed endpoint GUID.")

candidate_edge_count = edges.count()
source_node_ids = nodes.select(F.col("node_id").alias("source_node_id"))
target_node_ids = nodes.select(F.col("node_id").alias("target_node_id"))
edges = (
    edges.join(source_node_ids, "source_node_id", "left_semi")
    .join(target_node_ids, "target_node_id", "left_semi")
)
excluded_edge_count = candidate_edge_count - edges.count()

assert_unique(nodes, "node_id", "Graph nodes")
assert_unique(edges, "edge_id", "Graph edges")

node_ids = nodes.select(F.col("node_id").alias("known_node_id"))
orphan_sources = edges.join(
    node_ids, edges.source_node_id == node_ids.known_node_id, "left_anti"
)
orphan_targets = edges.join(
    node_ids, edges.target_node_id == node_ids.known_node_id, "left_anti"
)
orphan_count = orphan_sources.count() + orphan_targets.count()
if orphan_count:
    raise ValueError(f"Graph contains {orphan_count} orphaned edge endpoints.")

nodes.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable("graph_nodes")
edges.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable("graph_edges")

# CELL ********************

node_count = spark.table("graph_nodes").count()
edge_count = spark.table("graph_edges").count()
print(
    json.dumps(
        {
            "mappingVersion": mapping["version"],
            "runId": run_id,
            "nodeCount": node_count,
            "edgeCount": edge_count,
            "outOfScopeEdgeCount": excluded_edge_count,
            "orphanEndpointCount": orphan_count,
        }
    )
)

display(
    spark.table("graph_nodes")
    .groupBy("node_type")
    .count()
    .orderBy(F.desc("count"), "node_type")
)
display(
    spark.table("graph_edges")
    .groupBy("relationship_type")
    .count()
    .orderBy(F.desc("count"), "relationship_type")
)

# CELL ********************

# Example traversal: Account -> Order -> OrderLine -> Product
nodes_view = spark.table("graph_nodes")
edges_view = spark.table("graph_edges")

account_orders = edges_view.where(F.col("relationship_type") == "PLACED")
order_lines = edges_view.where(F.col("relationship_type") == "CONTAINS")
line_products = edges_view.where(F.col("relationship_type") == "REFERENCES")

account_to_product = (
    account_orders.alias("ao")
    .join(order_lines.alias("ol"), F.col("ao.target_node_id") == F.col("ol.source_node_id"))
    .join(line_products.alias("lp"), F.col("ol.target_node_id") == F.col("lp.source_node_id"))
    .join(nodes_view.alias("a"), F.col("ao.source_node_id") == F.col("a.node_id"))
    .join(nodes_view.alias("p"), F.col("lp.target_node_id") == F.col("p.node_id"))
    .select(
        F.col("a.label").alias("account"),
        F.col("p.label").alias("product"),
        F.col("ao.source_node_id").alias("account_node_id"),
        F.col("lp.target_node_id").alias("product_node_id"),
    )
    .dropDuplicates()
)
display(account_to_product)

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }
