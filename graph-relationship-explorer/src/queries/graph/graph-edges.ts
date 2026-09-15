import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./graph-edges.dax?raw";

const connection = "graphModel";

export const graphEdgeColumnMetadata: ColumnMetadataMap = {
    "[EdgeId]": { name: "EdgeId", displayName: "Edge ID" },
    "[RelationshipType]": {
        name: "RelationshipType",
        displayName: "Relationship",
    },
    "[SourceNodeId]": { name: "SourceNodeId", displayName: "Source" },
    "[TargetNodeId]": { name: "TargetNodeId", displayName: "Target" },
};

export function graphEdges() {
    return {
        connection,
        query,
        columnMetadata: graphEdgeColumnMetadata,
    };
}
