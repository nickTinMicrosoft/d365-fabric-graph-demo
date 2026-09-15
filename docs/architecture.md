# Architecture

## Purpose

This solution turns Dynamics 365 and Dataverse relationships into a governed analytical graph in Microsoft Fabric. It preserves Dataverse as the operational system of record and uses Fabric for scalable relationship analysis, reporting, graph algorithms, and AI consumption.

## Logical architecture

```text
Dynamics 365 / Dataverse
  standard and custom tables
  primary keys and lookup relationships
             |
             | Link data via Fabric
             v
Dataverse-generated landing Lakehouse
  managed synchronized Delta tables
  SQL analytics endpoint
  generated semantic model
             |
             | configuration-driven Spark notebook
             v
Curated graph Lakehouse
  graph_nodes
  graph_edges
  graph_node_<entity>
  graph_edge_<relationship>
             |
             +--> Spark and notebook traversal
             +--> SQL analytics endpoint
             +--> Power BI semantic model
             +--> Fabric Data App
             +--> data science and AI workloads
```

## Design decisions

### Keep the landing and curated Lakehouses separate

The Dataverse link owns the generated landing artifacts. Do not write transformations into those tables or treat the generated Lakehouse as an application-owned data store. The graph notebook reads the landing tables and writes only to the curated Lakehouse.

### Model a property graph using two stable contracts

`graph_nodes` contains one row per business record:

| Column | Meaning |
|---|---|
| `node_id` | Stable typed identifier, such as `Account:<guid>` |
| `node_type` | Logical business entity type |
| `label` | Human-readable record label |
| `business_key` | Stable business identifier where available |
| `properties_json` | Type-specific analytical properties |
| `source_table` | Dataverse source table |
| `source_record_id` | Original Dataverse GUID |
| `source_modified_at` | Source change timestamp when available |
| `source_version` | Dataverse row version when available |
| `mapping_version` | Mapping version used for the build |
| `run_id` | Identifier shared by rows from one build |
| `curated_at` | UTC build timestamp |

`graph_edges` contains one row per relationship:

| Column | Meaning |
|---|---|
| `edge_id` | SHA-256 of mapping ID, source row, and endpoints |
| `source_node_id` | Typed source node identifier |
| `target_node_id` | Typed target node identifier |
| `relationship_type` | Business relationship name |
| `source_table` | Dataverse table containing the lookup |
| `source_record_id` | Dataverse row containing the relationship |
| `properties_json` | Relationship-specific properties |
| `source_modified_at` | Source change timestamp when available |
| `source_version` | Dataverse row version when available |
| `mapping_version` | Mapping version used for the build |
| `run_id` | Identifier shared by rows from one build |
| `curated_at` | UTC build timestamp |

The notebook also materializes one managed table per node and relationship type.
These typed projections provide unambiguous source tables for Fabric Graph
Model and Fabric IQ Ontology bindings while `graph_nodes` and `graph_edges`
remain the stable, unified analytical contracts.

### Separate mapping from transformation logic

`config/graph-mapping.json` controls tables, candidate columns, labels, properties, filters, and relationship directions. An implementation should modify this mapping after source discovery rather than fork the Spark transformation for each environment.

### Treat Fabric as analytical, not transactional

The curated graph is optimized for analysis and traversal. Dynamics 365 remains authoritative for record creation, validation, workflows, and security-sensitive transactions. Do not write graph changes back to Dataverse without a separately governed integration process.

## Data flow and refresh

1. Dataverse synchronizes selected tables into its Fabric-linked landing Lakehouse.
2. The graph notebook runs after the source refresh window.
3. The notebook validates column mappings and referential integrity.
4. It validates the complete graph and then replaces the curated node and edge
   Delta tables sequentially. The shared `run_id` identifies rows from the same
   build; the two writes aren't a cross-table transaction.
5. Downstream reports and analysis read only the curated contract.

## Consumption architecture

The native Fabric Graph Model and the Fabric Data App are complementary
consumption surfaces:

- The Graph Model provides general visual exploration and GQL traversal.
- The Direct Lake semantic model exposes the typed graph tables through DAX.
- The Relationship Lens Fabric Data App uses those live DAX results for a
  controlled invoice investigation workflow, relationship drill-down, KPIs,
  and a deterministic English narrative.

The application does not write to Dataverse or duplicate the curated graph.
Fabric brokered authentication identifies the user, while semantic-model Build
and Read permissions govern query access.

For larger implementations, replace full overwrite with watermark-based incremental processing and Delta `MERGE`. Retain full overwrite for small demonstrations because it is deterministic and easy to validate.
