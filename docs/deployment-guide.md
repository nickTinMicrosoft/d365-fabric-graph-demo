# Deployment guide

## 1. Prerequisites

- A Dynamics 365 or Dataverse environment containing the required tables.
- Dataverse System Administrator access for initial link configuration.
- A Fabric capacity in the same Azure geography as the Dataverse environment.
- Fabric workspace creation permission and capacity contributor access.
- Permission to create Lakehouses, notebooks, workspace identities, and connections.
- Azure CLI for scripted Fabric item deployment.

Use a development environment and synthetic or approved nonproduction data first.

## 2. Discover the source model

Inventory:

- Table logical names and entity-set names.
- Whether **Track changes** is enabled for every table to be linked.
- Primary ID and primary-name columns.
- Business keys.
- Lookup columns and relationship direction.
- Polymorphic lookups such as customer or regarding.
- Many-to-many intersect tables.
- Choice labels required for reporting.
- Ownership, business-unit, team, and row-security requirements.

Record the result in `config/graph-mapping.json`. Keep multiple candidate column names for lookup values because linked-table naming can vary from Web API lookup-property naming.

## 3. Create the Fabric workspace

Create a dedicated workspace on a capacity in the same geography as Dataverse. Avoid using a personal workspace.

Create and provision a workspace identity. Add its application ID to Dataverse as an application user and grant only the security role required to read the selected source tables. System Administrator is acceptable for initial setup but should be replaced with a least-privilege role before production.

References:

- [Create a Fabric workspace](https://learn.microsoft.com/rest/api/fabric/core/workspaces/create-workspace)
- [Provision workspace identity](https://learn.microsoft.com/rest/api/fabric/core/workspaces/provision-identity)
- [Manage Dataverse application users](https://learn.microsoft.com/power-platform/admin/manage-application-users)

## 4. Create the Dataverse Link to Fabric

In [Power Apps](https://make.powerapps.com):

1. Select the source environment.
2. Open **Link data**.
3. Select **New link**.
4. Select **Link data via Fabric**.
5. Select the target Fabric workspace.
6. Select workspace identity authentication when available.
7. Select only approved tables.
8. Review and create the link.
9. Wait for initial synchronization to complete.

Only tables with **Track changes** enabled are selected by default. Enable it in each
table's advanced properties before creating the link; it can't be disabled later.

The wizard creates a landing Lakehouse, SQL endpoint, and semantic model. Record the generated Lakehouse name and item ID in the deployment configuration.

Do not create an Azure storage account or Synapse workspace for this direct-link pattern.

Reference: [Configure and link Dataverse to Fabric](https://learn.microsoft.com/power-apps/maker/data-platform/fabric-link-to-data-platform)

## 5. Deploy the curated graph items

Create `lh_d365_graph_curated` in the target workspace. Deploy `nb_build_dataverse_graph` and attach it to that Lakehouse.

Before publishing the notebook definition, replace:

- `__SOURCE_WORKSPACE_ID__` with the target workspace ID.
- `__SOURCE_LAKEHOUSE_ID__` with the Dataverse-generated landing Lakehouse ID.
- `__GRAPH_MAPPING_JSON__` with the serialized mapping file.

The notebook accesses source Delta tables through their OneLake ABFS paths and writes `graph_nodes` and `graph_edges` into its attached curated Lakehouse.

The included deployment script performs those replacements and creates or updates the items:

```powershell
python scripts\deploy_fabric_graph.py --config config\deployment.example.json
```

After the link has synchronized and the mapping has been validated, deploy and execute:

```powershell
python scripts\deploy_fabric_graph.py --config config\deployment.example.json --run
```

## 6. Validate

Confirm:

- All mapped landing tables exist.
- Candidate ID, label, key, and lookup columns resolve.
- Expected node types and edge types have nonzero counts.
- `node_id` and `edge_id` are unique.
- No edge endpoint is absent from `graph_nodes`.
- Sample business paths produce the expected records.
- A Dataverse source update appears after link synchronization and the next notebook run.

## 7. Schedule

Run the graph notebook after the expected Dataverse synchronization interval. Use a Fabric pipeline or notebook schedule. Avoid scheduling more frequently than source data can arrive.

For production, alert on failed notebook jobs, missing source tables, mapping errors, orphan endpoints, and unexpected count changes.

## 8. Create the visual Graph Model

Deploy a native Fabric Graph Model over the curated node and edge tables:

```powershell
python scripts\deploy_fabric_graph_model.py `
  --workspace-id <workspace-guid> `
  --lakehouse-id <curated-lakehouse-guid>
```

The model defines separate Account, Contact, Product, Order, OrderLine,
Invoice, and ServiceCase node types and maps all configured relationship types.
It reads the managed `graph_node_<entity>` and `graph_edge_<relationship>`
projection tables generated by the notebook. The deployment is idempotent and
uses the public Graph Model REST API.

Open `gm_d365_relationships` once in the Fabric portal after its first
deployment. Fabric requires this one-time action to provision the graph's
internal loading infrastructure. Select **Save**, wait for data loading to
complete, and then use **Query** mode for visual exploration and GQL queries.

Graph Model and Fabric IQ Ontology are preview features. An ontology is an
optional semantic layer for business vocabulary, governance, and agent
grounding; it isn't required to visualize this graph.

For exact table mappings, portal steps, GQL examples, expected demo counts, and
the refresh sequence, follow
[Build and view the graph in Microsoft Fabric](fabric-graph-walkthrough.md).
