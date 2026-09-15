import type { DataTable } from "@microsoft/fabric-visuals-core";

export interface GraphNode {
    id: string;
    type: string;
    label: string;
    businessKey: string;
    properties: Record<string, unknown>;
}

export interface GraphEdge {
    id: string;
    relationshipType: string;
    sourceNodeId: string;
    targetNodeId: string;
}

export interface InvoiceView {
    invoice: GraphNode;
    order?: GraphNode;
    account?: GraphNode;
    contacts: GraphNode[];
    orderLines: GraphNode[];
    products: GraphNode[];
    serviceCases: GraphNode[];
    nodes: GraphNode[];
    edges: GraphEdge[];
    summary: string;
}

export interface GraphMetrics {
    totalNodes: number;
    totalEdges: number;
    invoiceCount: number;
    totalInvoiceAmount: number;
    openCaseCount: number;
}

function columnIndex(table: DataTable, name: string): number {
    const index = table.columns.findIndex((column) => column.name === name);
    if (index < 0) {
        throw new Error(`Graph query result is missing the "${name}" column.`);
    }
    return index;
}

function requiredString(
    row: readonly unknown[],
    index: number,
    field: string,
): string {
    const value = row[index];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Graph query returned an invalid ${field}.`);
    }
    return value;
}

function parseProperties(value: unknown, nodeId: string): Record<string, unknown> {
    if (typeof value !== "string") {
        throw new Error(`Node "${nodeId}" has non-text properties.`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (error) {
        throw new Error(`Node "${nodeId}" contains invalid properties JSON.`, {
            cause: error,
        });
    }

    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error(`Node "${nodeId}" properties must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
}

export function parseGraphNodes(table: DataTable): GraphNode[] {
    const idIndex = columnIndex(table, "NodeId");
    const typeIndex = columnIndex(table, "NodeType");
    const labelIndex = columnIndex(table, "Label");
    const businessKeyIndex = columnIndex(table, "BusinessKey");
    const propertiesIndex = columnIndex(table, "PropertiesJson");

    return table.rows.map((row) => {
        const id = requiredString(row, idIndex, "node ID");
        return {
            id,
            type: requiredString(row, typeIndex, "node type"),
            label: requiredString(row, labelIndex, "node label"),
            businessKey: requiredString(row, businessKeyIndex, "business key"),
            properties: parseProperties(row[propertiesIndex], id),
        };
    });
}

export function parseGraphEdges(table: DataTable): GraphEdge[] {
    const idIndex = columnIndex(table, "EdgeId");
    const relationshipIndex = columnIndex(table, "RelationshipType");
    const sourceIndex = columnIndex(table, "SourceNodeId");
    const targetIndex = columnIndex(table, "TargetNodeId");

    return table.rows.map((row) => ({
        id: requiredString(row, idIndex, "edge ID"),
        relationshipType: requiredString(
            row,
            relationshipIndex,
            "relationship type",
        ),
        sourceNodeId: requiredString(row, sourceIndex, "source node ID"),
        targetNodeId: requiredString(row, targetIndex, "target node ID"),
    }));
}

export function getStringProperty(
    node: GraphNode | undefined,
    property: string,
): string | undefined {
    const value = node?.properties[property];
    return typeof value === "string" ? value : undefined;
}

export function getNumberProperty(
    node: GraphNode | undefined,
    property: string,
): number | undefined {
    const value = node?.properties[property];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function formatCurrency(value: number | undefined): string {
    if (value === undefined) {
        return "Not available";
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function connectedTargets(
    sourceNodeId: string | undefined,
    relationshipType: string,
    nodesById: ReadonlyMap<string, GraphNode>,
    edges: readonly GraphEdge[],
): GraphNode[] {
    if (!sourceNodeId) {
        return [];
    }
    return edges
        .filter(
            (edge) =>
                edge.sourceNodeId === sourceNodeId &&
                edge.relationshipType === relationshipType,
        )
        .map((edge) => nodesById.get(edge.targetNodeId))
        .filter((node): node is GraphNode => node !== undefined);
}

function connectedSource(
    targetNodeId: string | undefined,
    relationshipType: string,
    nodesById: ReadonlyMap<string, GraphNode>,
    edges: readonly GraphEdge[],
): GraphNode | undefined {
    if (!targetNodeId) {
        return undefined;
    }
    const edge = edges.find(
        (candidate) =>
            candidate.targetNodeId === targetNodeId &&
            candidate.relationshipType === relationshipType,
    );
    return edge ? nodesById.get(edge.sourceNodeId) : undefined;
}

function buildSummary(
    invoice: GraphNode,
    order: GraphNode | undefined,
    account: GraphNode | undefined,
    products: readonly GraphNode[],
    serviceCases: readonly GraphNode[],
): string {
    const invoiceName =
        getStringProperty(invoice, "invoiceNumber") ?? invoice.label;
    const status = getStringProperty(invoice, "status") ?? "unknown status";
    const amount = formatCurrency(getNumberProperty(invoice, "totalAmount"));
    const accountPhrase = account
        ? ` for ${account.label}`
        : " with no connected account";
    const orderPhrase = order ? ` through ${order.label}` : "";
    const productPhrase = `${products.length} connected product${
        products.length === 1 ? "" : "s"
    }`;
    const openCases = serviceCases.filter(
        (serviceCase) =>
            getStringProperty(serviceCase, "status")?.toLowerCase() === "open",
    );
    const casePhrase =
        openCases.length === 0
            ? "no open service cases"
            : `${openCases.length} open service case${
                  openCases.length === 1 ? "" : "s"
              }`;

    return `${invoiceName} is ${status} for ${amount}${accountPhrase}${orderPhrase}. Its relationship path reaches ${productPhrase} and ${casePhrase}.`;
}

export function buildInvoiceView(
    invoiceId: string,
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
): InvoiceView {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const invoice = nodesById.get(invoiceId);
    if (!invoice || invoice.type !== "Invoice") {
        throw new Error(`Invoice node "${invoiceId}" was not found.`);
    }

    const order = connectedSource(invoice.id, "GENERATED", nodesById, edges);
    const account = connectedSource(order?.id, "PLACED", nodesById, edges);
    const contacts = edges
        .filter(
            (edge) =>
                edge.targetNodeId === account?.id &&
                edge.relationshipType === "BELONGS_TO",
        )
        .map((edge) => nodesById.get(edge.sourceNodeId))
        .filter((node): node is GraphNode => node !== undefined);
    const orderLines = connectedTargets(
        order?.id,
        "CONTAINS",
        nodesById,
        edges,
    );
    const products = orderLines.flatMap((line) =>
        connectedTargets(line.id, "REFERENCES", nodesById, edges),
    );
    const serviceCases = connectedTargets(
        account?.id,
        "OPENED",
        nodesById,
        edges,
    );
    const selectedNodeIds = new Set(
        [
            invoice,
            order,
            account,
            ...contacts,
            ...orderLines,
            ...products,
            ...serviceCases,
        ]
            .filter((node): node is GraphNode => node !== undefined)
            .map((node) => node.id),
    );
    const selectedEdges = edges.filter(
        (edge) =>
            selectedNodeIds.has(edge.sourceNodeId) &&
            selectedNodeIds.has(edge.targetNodeId),
    );

    return {
        invoice,
        order,
        account,
        contacts,
        orderLines,
        products,
        serviceCases,
        nodes: [...selectedNodeIds]
            .map((id) => nodesById.get(id))
            .filter((node): node is GraphNode => node !== undefined),
        edges: selectedEdges,
        summary: buildSummary(
            invoice,
            order,
            account,
            products,
            serviceCases,
        ),
    };
}

export function getGraphMetrics(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
): GraphMetrics {
    const invoices = nodes.filter((node) => node.type === "Invoice");
    const openCases = nodes.filter(
        (node) =>
            node.type === "ServiceCase" &&
            getStringProperty(node, "status")?.toLowerCase() === "open",
    );
    return {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        invoiceCount: invoices.length,
        totalInvoiceAmount: invoices.reduce(
            (total, invoice) =>
                total + (getNumberProperty(invoice, "totalAmount") ?? 0),
            0,
        ),
        openCaseCount: openCases.length,
    };
}
