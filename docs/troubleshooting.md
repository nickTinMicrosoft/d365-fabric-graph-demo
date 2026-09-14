# Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Target workspace is absent from the link wizard | Wrong tenant, unsupported geography, missing workspace role, or workspace not on eligible capacity | Verify tenant, region, capacity assignment, and workspace admin access |
| Workspace identity cannot connect | Identity not provisioned or not added as a Dataverse application user | Provision identity, add its application ID in the environment, and assign a read role |
| Table is absent from selection | Unsupported table, table feature settings, or insufficient privileges | Confirm table eligibility, permissions, and change-tracking requirements |
| Linked table is initially unidentified | Initial Dataverse synchronization is incomplete | Wait for initial sync and recheck link status |
| Notebook reports a missing table | Link table selection differs from the mapping | Add the table to the link or update `graph-mapping.json` |
| Notebook reports missing candidate columns | Linked Delta schema uses another logical lookup name | Inspect columns and add the observed name to the candidate list |
| Orphan edge validation fails | Target table was not linked, source lookup is polymorphic, or filters exclude targets | Link target tables and align filters; split polymorphic relationships by target type |
| Counts suddenly drop | Source sync delay, table removed from link, source security change, or schema change | Check link status and source-table counts before rerunning |
| Notebook cannot write curated tables | Wrong default Lakehouse attachment or insufficient workspace permissions | Attach the curated Lakehouse and verify contributor access |
| Consumers see more data than expected | Fabric authorization does not match Dataverse roles | Implement OneLake, SQL, and semantic-model security before sharing |

## Polymorphic lookups

Customer, owner, and regarding lookups can target more than one table. A production mapping must use the associated type discriminator and emit the correct typed node identifier. Do not assume every customer lookup targets Account.

## Many-to-many relationships

Link the intersect table when available and map each row to one edge. If the platform does not expose an expected intersect table, materialize the relationship using an approved upstream or transformation method and document ownership.

## Support evidence

Capture:

- Power Platform environment ID.
- Fabric workspace and capacity IDs.
- Workspace identity application ID.
- Landing and curated Lakehouse item IDs.
- Link table status.
- Notebook job instance ID.
- Mapping version.
- Node/edge counts and orphan count.

Never include access tokens, client secrets, or customer record values in support artifacts.
