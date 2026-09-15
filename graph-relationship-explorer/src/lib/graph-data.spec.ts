import { describe, expect, it } from "vitest";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import {
    buildInvoiceView,
    getGraphMetrics,
    parseGraphEdges,
    parseGraphNodes,
} from "./graph-data";

const nodeTable: DataTable = {
    columns: [
        { name: "NodeId" },
        { name: "NodeType" },
        { name: "Label" },
        { name: "BusinessKey" },
        { name: "PropertiesJson" },
    ],
    rows: [
        [
            "Invoice:1",
            "Invoice",
            "Invoice One",
            "INV-1",
            '{"invoiceNumber":"INV-1","status":"Issued","totalAmount":60000}',
        ],
        [
            "Order:1",
            "Order",
            "Modernization order",
            "ORDER-1",
            '{"status":"Active"}',
        ],
        ["Account:1", "Account", "City Services", "ACCT-1", "{}"],
        ["Contact:1", "Contact", "Maya Chen", "CONTACT-1", "{}"],
        ["OrderLine:1", "OrderLine", "Permit line", "LINE-1", "{}"],
        ["Product:1", "Product", "Permit Suite", "PROD-1", "{}"],
        [
            "ServiceCase:1",
            "ServiceCase",
            "Workflow help",
            "CASE-1",
            '{"status":"Open"}',
        ],
    ],
};

const edgeTable: DataTable = {
    columns: [
        { name: "EdgeId" },
        { name: "RelationshipType" },
        { name: "SourceNodeId" },
        { name: "TargetNodeId" },
    ],
    rows: [
        ["e1", "GENERATED", "Order:1", "Invoice:1"],
        ["e2", "PLACED", "Account:1", "Order:1"],
        ["e3", "BELONGS_TO", "Contact:1", "Account:1"],
        ["e4", "CONTAINS", "Order:1", "OrderLine:1"],
        ["e5", "REFERENCES", "OrderLine:1", "Product:1"],
        ["e6", "OPENED", "Account:1", "ServiceCase:1"],
        ["e7", "REPORTED", "Contact:1", "ServiceCase:1"],
    ],
};

describe("graph data", () => {
    it("parses verified Fabric query columns", () => {
        const nodes = parseGraphNodes(nodeTable);
        const edges = parseGraphEdges(edgeTable);

        expect(nodes[0].properties.totalAmount).toBe(60000);
        expect(edges[0]).toEqual({
            id: "e1",
            relationshipType: "GENERATED",
            sourceNodeId: "Order:1",
            targetNodeId: "Invoice:1",
        });
    });

    it("builds the complete invoice relationship view", () => {
        const view = buildInvoiceView(
            "Invoice:1",
            parseGraphNodes(nodeTable),
            parseGraphEdges(edgeTable),
        );

        expect(view.order?.label).toBe("Modernization order");
        expect(view.account?.label).toBe("City Services");
        expect(view.contacts).toHaveLength(1);
        expect(view.products).toHaveLength(1);
        expect(view.serviceCases).toHaveLength(1);
        expect(view.edges).toHaveLength(7);
        expect(view.summary).toContain(
            "INV-1 is Issued for $60,000 for City Services",
        );
    });

    it("computes graph-wide live metrics", () => {
        const metrics = getGraphMetrics(
            parseGraphNodes(nodeTable),
            parseGraphEdges(edgeTable),
        );

        expect(metrics).toEqual({
            totalNodes: 7,
            totalEdges: 7,
            invoiceCount: 1,
            totalInvoiceAmount: 60000,
            openCaseCount: 1,
        });
    });

    it("surfaces malformed properties instead of silently discarding them", () => {
        const invalid: DataTable = {
            ...nodeTable,
            rows: [["Invoice:bad", "Invoice", "Bad", "BAD", "{not-json}"]],
        };

        expect(() => parseGraphNodes(invalid)).toThrow(
            'Node "Invoice:bad" contains invalid properties JSON.',
        );
    });
});
