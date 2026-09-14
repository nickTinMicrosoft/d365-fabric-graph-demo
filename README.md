# D365 Fabric Graph Demo

This project builds a reusable Dynamics 365/Dataverse-to-Microsoft Fabric
relationship-graph demo. It creates synthetic business records and real
Dataverse lookups, links those tables into a Fabric landing Lakehouse, and
builds curated graph node and edge tables.

## Demo model

The solution uses standard Dataverse `account` and `contact` tables plus these custom tables:

| Table | Purpose |
|---|---|
| Product | Products referenced by order lines |
| Order | Customer orders |
| Order Line | Connects orders and products |
| Invoice | Invoices generated from orders |
| Service Case | Customer cases associated with accounts and contacts |

The model supports relationship paths such as:

```text
Contact -> Account -> Order -> Order Line -> Product
                       |
                       +-> Invoice

Contact -> Service Case -> Account
```

## Demo scope

The sample targets a Dataverse development environment rather than requiring a
licensed Dynamics 365 first-party application. It uses standard Account and
Contact tables plus custom business tables so the relationship and Fabric-link
pattern can be demonstrated with synthetic data. A production deployment should
replace the mapping with the organization's actual Dynamics 365 or Dataverse
schema, security model, and operational requirements.

## Prerequisites for redeployment

- An enabled Dataverse environment.
- The deploying account must have the Dataverse **System Administrator** role.
- Azure CLI must be authenticated to the environment's tenant.
- Python 3.11 or newer.

## Deploy the D365 components

Authenticate Azure CLI to the environment tenant:

```powershell
az login --allow-no-subscriptions --tenant <tenant-id>
```

Create the solution, tables, columns, and relationships:

```powershell
python scripts\deploy_schema.py --environment-url https://<environment>.crm.dynamics.com
```

Load or update the synthetic demo records:

```powershell
python scripts\seed_data.py --environment-url https://<environment>.crm.dynamics.com
```

Confirm every record and lookup relationship:

```powershell
python scripts\verify_demo.py --environment-url https://<environment>.crm.dynamics.com
```

Deploy or update the interactive D365 graph view:

```powershell
python scripts\deploy_graph_view.py --environment-url https://<environment>.crm.dynamics.com
```

Open the deployed graph while signed into the environment:

```text
https://<environment>.crm.dynamics.com/WebResources/dfd_graphviewer.html
```

The graph queries Dataverse directly in the signed-in user's security context. It has no external JavaScript dependencies and does not copy records outside D365.

## Fabric analytical graph

The Fabric implementation is stored under `fabric/` and is controlled by:

- `config/graph-mapping.json` — source tables, node types, properties, and lookup-to-edge mappings.
- `config/deployment.example.json` — environment-specific values required by a deployment.
- `docs/architecture.md` — landing and curated Lakehouse design.
- `docs/deployment-guide.md` — complete deployment procedure.
- `docs/fabric-graph-walkthrough.md` — step-by-step Fabric build, visual
  exploration, GQL, and refresh walkthrough.
- `docs/security-and-operations.md` — production security and operating guidance.
- `docs/troubleshooting.md` — common failure modes and resolutions.

The Dataverse-generated landing Lakehouse remains read-only to the solution. `nb_build_dataverse_graph` reads it through OneLake and writes only `graph_nodes` and `graph_edges` to `lh_d365_graph_curated`.

Deploy a native Fabric Graph Model over the curated tables:

```powershell
python scripts\deploy_fabric_graph_model.py `
  --workspace-id <workspace-guid> `
  --lakehouse-id <curated-lakehouse-guid>
```

Open `gm_d365_relationships` once in the Fabric portal to initialize its
internal loading infrastructure, then select **Save** to load the model. Switch
to **Query** mode to explore the graph visually or query it with GQL. Fabric
currently requires this one-time portal initialization even when the complete
Graph Model definition is deployed through its public REST API.

For the exact end-to-end procedure and manual portal equivalent, see
[Build and view the graph in Microsoft Fabric](docs/fabric-graph-walkthrough.md).

Verify the local project definition:

```powershell
python -m unittest discover -s tests -v
```

The scripts acquire a delegated Dataverse token through Azure CLI. They do not store credentials.

Copy `config/deployment.example.json` to `config/deployment.local.json` for
environment-specific Fabric identifiers. Local and demo deployment files are
excluded from version control.

## License

This demo and reference implementation is available under the [MIT License](LICENSE).
