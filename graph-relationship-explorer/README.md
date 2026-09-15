# Relationship Lens Fabric App

Relationship Lens is a Microsoft Fabric Data App that turns a curated
Dataverse relationship graph into an invoice-centered investigation
experience. It reads a Power BI semantic model live through Fabric SSO and
does not cache or copy business data into the browser.

## Experience

- Select an invoice from live Fabric data.
- Follow the connected order, account, contacts, order lines, products, and
  service cases.
- Inspect any node's business key and typed properties.
- Read an evidence-based English summary generated deterministically from the
  selected relationship path.
- See graph-wide and invoice-specific indicators without leaving the app.

The app complements the native Fabric Graph Model. The Graph Model remains the
general-purpose visual and GQL exploration surface; Relationship Lens provides
a focused business workflow for invoice investigation.

## Architecture

```text
Dataverse
  -> Link to Fabric landing Lakehouse
  -> curated graph node and edge Delta tables
  -> Direct Lake semantic model
  -> Fabric Data App (React + Fabric SSO)
```

At runtime, the app executes two DAX queries:

- `src/queries/graph/graph-nodes.dax` unions the typed node projections.
- `src/queries/graph/graph-edges.dax` unions the typed edge projections.

The browser traverses only the returned graph for the selected invoice. It
does not persist graph data in local storage or an application database.

## Prerequisites

- Node.js 22.
- Azure CLI authenticated to the deployment tenant.
- A Fabric workspace on a capacity that supports Fabric Apps.
- Fabric Apps enabled in tenant settings.
- Semantic Model Execute Queries REST API enabled in tenant settings.
- A published semantic model exposing the typed `graph_node_*` and
  `graph_edge_*` tables described by this repository.
- Build and Read permissions on that semantic model.

## Configure the semantic model

Copy `fabric.example.yaml` to the ignored local file `fabric.yaml`, then
register the deployed model:

```powershell
npx fabric-app-data add semanticModel graphModel `
  -w <semantic-model-workspace-guid> `
  -i <semantic-model-guid>

npx fabric-app-data generate -o src\fabric.generated.ts
```

`fabric.yaml`, generated connection code, Rayfin environment files, and
deployment metadata are ignored because they contain environment-specific
resource identifiers.

## Develop and validate

```powershell
npm install
npm test
npm run lint
npm run build
```

Fabric authentication requires the portal embed flow for interactive
validation. Provision the application backend, start the development server,
and use the generated portal URL:

```powershell
npx rayfin up --workspace-id <app-workspace-guid> --yes
npm run dev
npm run test:fabric
```

## Deploy

Deploy or update the app with the supported Rayfin CLI:

```powershell
npx rayfin up --workspace-id <app-workspace-guid> --yes
```

Deployment creates or updates the Fabric App item, applies Fabric brokered
authentication, builds the React frontend, and publishes its static content.
Grant consumers **Run and interact** on the app and Build/Read on the semantic
model.

Fabric Apps and some related Graph experiences may be preview features. Review
regional availability and current Microsoft documentation before production
adoption:

- [Fabric Apps overview](https://learn.microsoft.com/fabric/apps/overview)
- [Data App template](https://learn.microsoft.com/fabric/apps/data-apps-template)
- [Deploy a Fabric App](https://learn.microsoft.com/fabric/apps/deploy-app)
