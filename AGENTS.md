# Repository instructions

- Keep customer and production data out of this repository. All demo records must be synthetic.
- Use the `dfd` publisher prefix for custom Dataverse components.
- Keep deployment scripts idempotent so rerunning them updates rather than duplicates demo records.
- Do not create, modify, or connect to Microsoft Fabric resources until the Fabric phase is explicitly requested.
- Keep the D365 source model suitable for a later Dataverse Link to Fabric: use real Dataverse relationships and stable demo identifiers.
