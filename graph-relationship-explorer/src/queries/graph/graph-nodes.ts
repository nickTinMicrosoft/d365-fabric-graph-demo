import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./graph-nodes.dax?raw";

const connection = "graphModel";

export const graphNodeColumnMetadata: ColumnMetadataMap = {
    "[NodeId]": { name: "NodeId", displayName: "Node ID" },
    "[NodeType]": { name: "NodeType", displayName: "Type" },
    "[Label]": { name: "Label", displayName: "Record" },
    "[BusinessKey]": { name: "BusinessKey", displayName: "Business key" },
    "[PropertiesJson]": { name: "PropertiesJson", displayName: "Properties" },
};

export function graphNodes() {
    return {
        connection,
        query,
        columnMetadata: graphNodeColumnMetadata,
    };
}
