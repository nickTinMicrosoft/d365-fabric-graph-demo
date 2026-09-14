# Build and view the graph in Microsoft Fabric

This walkthrough reproduces the Fabric implementation in this repository:

```text
Dataverse Link to Fabric landing Lakehouse
                    |
                    v
       nb_build_dataverse_graph
                    |
                    v
        lh_d365_graph_curated
        - graph_nodes / graph_edges
        - typed node and edge tables
                    |
                    v
         gm_d365_relationships
         Fabric Graph Model
```

The resulting Graph Model provides Fabric's native visual explorer and GQL
query surface. Fabric IQ Ontology is optional and isn't required for these
steps.

## 1. Check the prerequisites

You need:

- A Fabric capacity of F2 or higher in a region that supports Graph.
- A Fabric workspace where you are a Contributor, Member, or Admin.
- A Dataverse environment in the same geography as the Fabric capacity.
- Dataverse System Administrator access for initial link configuration.
- Permission to create Lakehouses, notebooks, Graph Models, workspace
  identities, and Fabric connections.
- Azure CLI authenticated to the correct tenant.
- Python 3.11 or newer.
- The Dataverse tables and relationships deployed and populated as described in
  the project [README](../README.md).

Graph Model is currently a preview Fabric feature. If **Graph model** doesn't
appear under **New item**, confirm that the feature is available in the capacity
region and enabled for the tenant.

## 2. Create the Fabric workspace and identity

1. Open [Microsoft Fabric](https://app.fabric.microsoft.com).
2. Create a workspace on a Fabric capacity in the same geography as Dataverse.
3. Open **Workspace settings > Workspace identity**.
4. Create the workspace identity and record its application ID.
5. In the Power Platform admin center, add that identity as a Dataverse
   application user.
6. Assign a role that can read every source table. System Administrator is
   acceptable for a demo; use a least-privilege custom role for production.

The workspace identity authenticates Fabric to Dataverse without storing a
client secret.

## 3. Create the Dataverse Link to Fabric

This initial link is currently created through the Power Apps interface:

1. Open [Power Apps](https://make.powerapps.com).
2. Select the Dataverse environment.
3. Open **Link data**.
4. Select **+ New link > Link data via Fabric**.
5. Select the Fabric workspace.
6. Select **Workspace Identity** authentication.
7. Select these demo tables:

   - Account
   - Contact
   - Demo Product
   - Demo Order
   - Demo Order Line
   - Demo Invoice
   - Demo Service Case

8. Review the configuration and select **Finish**.
9. Wait until all seven tables are active. Initial synchronization and later
   changes can take up to approximately 60 minutes.

The wizard creates a Dataverse-managed landing Lakehouse. Treat that Lakehouse
as read-only. Record its stable item ID rather than deriving anything from its
generated display name.

## 4. Prepare the deployment configuration

Copy the public template to a local file:

```powershell
Copy-Item config\deployment.example.json config\deployment.local.json
```

Populate at least:

```json
{
  "workspaceId": "<workspace-guid>",
  "sourceLakehouseId": "<dataverse-generated-lakehouse-guid>",
  "curatedLakehouseName": "lh_d365_graph_curated",
  "notebookName": "nb_build_dataverse_graph"
}
```

The scripts ignore unused fields. Keep real tenant and resource identifiers in
`deployment.local.json`; this filename is excluded from Git.

Authenticate Azure CLI:

```powershell
az login --allow-no-subscriptions --tenant <tenant-guid>
```

The scripts request delegated Fabric tokens from Azure CLI. They don't store
access tokens or credentials.

## 5. Review the source mapping

`config/graph-mapping.json` defines:

- Source tables and candidate column names.
- Node labels, keys, display labels, and properties.
- Relationship direction and endpoint columns.
- Filters that keep the standard Account and Contact tables scoped to the demo.

Linked Dataverse lookup-column names can vary. After the initial link finishes,
open each landing table and compare its schema with the candidate arrays in the
mapping. Add the actual linked column name if none of the candidates match.

## 6. Build the curated graph tables

Deploy and run the notebook:

```powershell
python scripts\deploy_fabric_graph.py `
  --config config\deployment.local.json `
  --run
```

The script:

1. Creates or finds `lh_d365_graph_curated`.
2. Renders the mapping and stable OneLake IDs into the notebook.
3. Creates or updates `nb_build_dataverse_graph`.
4. Runs the notebook and waits for completion.

The notebook writes the unified contracts:

- `graph_nodes`
- `graph_edges`

It also writes one managed table for each Graph Model type:

| Graph element | Curated table |
|---|---|
| Account node | `graph_node_account` |
| Contact node | `graph_node_contact` |
| Product node | `graph_node_product` |
| Order node | `graph_node_order` |
| OrderLine node | `graph_node_orderline` |
| Invoice node | `graph_node_invoice` |
| ServiceCase node | `graph_node_servicecase` |
| Contact BELONGS_TO Account | `graph_edge_contact_belongs_to_account` |
| Account PLACED Order | `graph_edge_account_placed_order` |
| Order CONTAINS OrderLine | `graph_edge_order_contains_orderline` |
| OrderLine REFERENCES Product | `graph_edge_orderline_references_product` |
| Order GENERATED Invoice | `graph_edge_order_generated_invoice` |
| Account OPENED ServiceCase | `graph_edge_account_opened_servicecase` |
| Contact REPORTED ServiceCase | `graph_edge_contact_reported_servicecase` |

Separate managed tables are intentional. They give each Fabric node and edge
type an unambiguous source and are also suitable for later ontology bindings.

For the included synthetic dataset, expect:

| Node type | Count |
|---|---:|
| Account | 3 |
| Contact | 3 |
| Product | 3 |
| Order | 3 |
| OrderLine | 4 |
| Invoice | 2 |
| ServiceCase | 2 |
| **Total** | **20** |

The seven relationship types contain 20 edges in total. The notebook fails on
duplicate IDs, malformed GUIDs, unresolved columns, or orphan endpoints.

## 7. Deploy the native Graph Model

Use the curated Lakehouse ID printed by the notebook deployment:

```powershell
python scripts\deploy_fabric_graph_model.py `
  --workspace-id <workspace-guid> `
  --lakehouse-id <curated-lakehouse-guid>
```

This creates or updates `gm_d365_relationships` through the public Fabric Graph
Model REST API. The script generates:

- Seven typed node definitions.
- Seven directed edge definitions.
- Fourteen OneLake Delta-table bindings.
- Node keys, properties, edge endpoint mappings, and model layout.

The command is idempotent. Running it again updates the existing model instead
of creating a duplicate.

## 8. Open and visually explore the graph

1. Open the Fabric workspace.
2. Select **gm_d365_relationships**.
3. On the first visit, allow Fabric to initialize the Graph Model editor.
4. If data loading didn't start after deployment, select **Save**.
5. Wait until the data-load or refresh job reports **Completed**.
6. Switch from **Model** mode to **Query** mode.
7. Use **Query builder** for a no-code pattern, or select **Code editor** for
   GQL.
8. Run the query and select the visual results view to expand, pan, and inspect
   connected records.

The Model canvas shows the seven entity types and relationship directions. The
Query canvas shows actual Dataverse-derived instances and connections.

## 9. Validate with GQL

Some labels and properties are GQL reserved words. Enclose names such as
`Order`, `Product`, `CONTAINS`, `REFERENCES`, and `label` in backticks.

### Count instances by node type

```gql
MATCH (n)
RETURN labels(n) AS node_labels, count(n) AS node_count
GROUP BY node_labels
ORDER BY node_labels;
```

### Visualize the complete demo graph

```gql
MATCH (source)-[relationship]->(target)
RETURN source, relationship, target;
```

If the result is too dense, use the query builder or filter to a specific
account.

### Traverse Account to Product

```gql
MATCH
  (a:Account)-[:PLACED]->(o:`Order`)
  -[:`CONTAINS`]->(line:OrderLine)
  -[:`REFERENCES`]->(p:`Product`)
RETURN
  a.`label` AS account_name,
  o.`label` AS order_name,
  line.`label` AS order_line,
  p.`label` AS product_name
ORDER BY account_name, order_name, order_line;
```

The included demo data returns four paths.

### Explore service cases

```gql
MATCH
  (contact:Contact)-[:REPORTED]->(case:ServiceCase)
RETURN contact, case;
```

## 10. Refresh the end-to-end solution

Refresh in this order:

1. Change or add a Dataverse record.
2. Wait for Link to Fabric to synchronize the source table.
3. Run `deploy_fabric_graph.py --run` to rebuild the curated tables.
4. Open `gm_d365_relationships` and select **Save**, or run its scheduled/on-
   demand refresh.
5. Rerun the GQL validation queries.

For recurring use, schedule the notebook after the expected Dataverse
synchronization window and schedule the Graph Model refresh after the notebook.
Don't refresh the graph more frequently than the source data can arrive.

## 11. Build the Graph Model manually instead

The automation is recommended because it keeps all environments consistent. To
reproduce it through the portal:

1. In the Fabric workspace, select **+ New item**.
2. Search for and create a **Graph model** named
   `gm_d365_relationships`.
3. Select **Get data** and add `lh_d365_graph_curated`.
4. Load the fourteen `graph_node_*` and `graph_edge_*` tables.
5. For each `graph_node_*` table, select **Add node**:
   - Use the corresponding entity name as the node label.
   - Use `node_id` as the key.
   - Add `label`, `business_key`, `properties_json`, `source_record_id`,
     `source_modified_at`, `mapping_version`, `run_id`, and `curated_at` as
     properties.
6. For each `graph_edge_*` table, select **Add edge**:
   - Use the uppercase relationship name as the edge label.
   - Select the origin and target node types shown in the table in section 6.
   - Map `source_node_id` to the origin node's `node_id`.
   - Map `target_node_id` to the target node's `node_id`.
7. Select **Save** and wait for the model to load.
8. Switch to **Query** mode and run the GQL examples.

## 12. Graph Model versus Ontology

This implementation uses **Graph in Microsoft Fabric**:

- It models and loads a labeled property graph from OneLake.
- It provides visual exploration, GQL, paths, and graph analytics.

**Fabric IQ Ontology** is a separate, optional preview semantic layer:

- It defines shared business vocabulary, properties, relationships, rules, and
  actions.
- It can bind entity types to the typed managed tables created here.
- It is useful for cross-domain governance and grounding Fabric or Copilot
  agents.

Use the Graph Model when the primary need is visual exploration and graph
queries. Add an ontology when the same entities and relationships must become a
governed, reusable business context layer for people and AI agents.

## References

- [Graph in Microsoft Fabric overview](https://learn.microsoft.com/fabric/graph/overview)
- [Graph Model quickstart](https://learn.microsoft.com/fabric/graph/quickstart)
- [Graph Model REST API](https://learn.microsoft.com/rest/api/fabric/graphmodel/items)
- [Graph Model definition](https://learn.microsoft.com/rest/api/fabric/articles/item-management/definitions/graph-model-definition)
- [Manage and refresh graph data](https://learn.microsoft.com/fabric/graph/manage-data)
- [Fabric IQ Ontology overview](https://learn.microsoft.com/fabric/iq/ontology/overview)
