import { describe, expect, it } from "vitest";
import { graphEdges } from "./graph-edges";
import { graphNodes } from "./graph-nodes";

describe("graph query factories", () => {
    it("targets the registered semantic model and preserves node metadata", () => {
        const result = graphNodes();

        expect(result.connection).toBe("graphModel");
        expect(result.query).toContain("'graph_node_invoice'");
        expect(result.columnMetadata["[PropertiesJson]"].name).toBe(
            "PropertiesJson",
        );
    });

    it("unifies every relationship table with verified output names", () => {
        const result = graphEdges();

        expect(result.query.match(/SELECTCOLUMNS/g)).toHaveLength(7);
        expect(result.columnMetadata["[RelationshipType]"].displayName).toBe(
            "Relationship",
        );
    });
});
