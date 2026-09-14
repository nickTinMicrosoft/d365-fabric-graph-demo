# Security and operations

## Identity

Use Fabric workspace identity for the Dataverse connection. It avoids user-password dependencies, expiring user sessions, and manually managed client secrets.

Create a Dataverse security role that grants organization-level read access only to:

- Selected source tables.
- Required lookup target tables.
- Metadata needed by the link.

Replace temporary System Administrator access after the link is stable.

## Authorization boundaries

Dataverse row-level security is not automatically reproduced as an identical Fabric authorization model. Design access separately at each layer:

- Workspace roles for engineers and operators.
- OneLake data access roles where appropriate.
- SQL endpoint permissions for SQL consumers.
- Semantic-model object and row-level security for reports.
- Sensitivity labels and tenant policies for exported data.

Do not expose the curated graph to a broader audience than the linked source data.

## Data minimization

Link only required tables and columns where the product supports selection. Exclude secrets, credentials, unnecessary personal data, file bodies, and high-volume activity tables unless they are part of an approved use case.

Avoid placing direct identifiers in `properties_json` when a stable opaque key is sufficient.

## Operations

Monitor:

- Dataverse link and table synchronization state.
- Fabric capacity utilization and throttling.
- Notebook duration and failures.
- Node and edge counts by type.
- Orphaned endpoints.
- Duplicate business keys.
- Schema drift and renamed columns.

Use the mapping version in notebook output as deployment evidence.

## Schema changes

When a Dataverse customization changes:

1. Confirm the table remains selected in the Fabric link.
2. Inspect the linked Delta schema.
3. Add the new logical column name to the candidate list.
4. Test in development.
5. Deploy the mapping and notebook together.
6. Compare counts and representative paths before promoting.

Removing a lookup can remove an edge class. Treat that as a breaking analytical change and notify downstream owners.

## Recovery

The curated graph is reproducible. If it is corrupted:

1. Stop the schedule.
2. Confirm landing tables are healthy.
3. Correct the mapping or notebook.
4. Rebuild both curated tables.
5. Validate endpoint integrity.
6. Resume scheduling.

Do not repair derived graph rows manually.
