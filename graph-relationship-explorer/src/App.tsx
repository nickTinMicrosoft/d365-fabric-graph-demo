//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from "react";
import { Banknote, Route, ShieldAlert, Waypoints } from "lucide-react";

import { graphEdges, graphNodes } from "@/queries";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { useThemeContext } from "@/hooks/theme.context";
import { toDataTable } from "@/lib/to-data-table";
import {
    buildInvoiceView,
    formatCurrency,
    getGraphMetrics,
    getNumberProperty,
    getStringProperty,
    parseGraphEdges,
    parseGraphNodes,
    type GraphEdge,
    type GraphNode,
} from "@/lib/graph-data";
import {
    GraphEmptyState,
    GraphErrorBanner,
    GraphLoadingSkeleton,
    GraphNarrative,
    InvoiceIndexList,
    KpiRow,
    NodeDetailsPanel,
    RelatedRecordsPanel,
    RelationshipLensHeader,
    RelationshipMap,
    type KpiCardItem,
} from "@/components/graph";

type ParsedGraph =
    | { nodes: GraphNode[]; edges: GraphEdge[]; parseError?: undefined }
    | { nodes?: undefined; edges?: undefined; parseError: string };

function App() {
    const { isDark, toggleTheme } = useThemeContext();

    const nodesFactory = useMemo(() => graphNodes(), []);
    const edgesFactory = useMemo(() => graphEdges(), []);

    const nodesQuery = useSemanticModelQuery({
        connection: nodesFactory.connection,
        query: nodesFactory.query,
    });
    const edgesQuery = useSemanticModelQuery({
        connection: edgesFactory.connection,
        query: edgesFactory.query,
    });

    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>();
    const [selectedNodeId, setSelectedNodeId] = useState<string>();

    const isLoading = nodesQuery.isLoading || edgesQuery.isLoading;

    const parsed = useMemo<ParsedGraph | undefined>(() => {
        if (
            nodesQuery.data?.status !== "success" ||
            edgesQuery.data?.status !== "success"
        ) {
            return undefined;
        }
        try {
            const nodeTable = toDataTable(
                nodesQuery.data.table,
                nodesFactory.columnMetadata,
            );
            const edgeTable = toDataTable(
                edgesQuery.data.table,
                edgesFactory.columnMetadata,
            );
            return {
                nodes: parseGraphNodes(nodeTable),
                edges: parseGraphEdges(edgeTable),
            };
        } catch (err) {
            return {
                parseError: err instanceof Error ? err.message : String(err),
            };
        }
    }, [nodesQuery.data, edgesQuery.data, nodesFactory, edgesFactory]);

    const graph = useMemo(() => {
        if (parsed && parsed.nodes && parsed.edges) {
            return { nodes: parsed.nodes, edges: parsed.edges };
        }
        return undefined;
    }, [parsed]);

    const queryErrorMessage =
        nodesQuery.error?.message ??
        (nodesQuery.data?.status === "error"
            ? nodesQuery.data.error.message
            : undefined) ??
        edgesQuery.error?.message ??
        (edgesQuery.data?.status === "error"
            ? edgesQuery.data.error.message
            : undefined);

    const errorMessage = queryErrorMessage ?? parsed?.parseError;

    const invoiceNodes = useMemo(() => {
        if (!graph) return [];
        return graph.nodes
            .filter((node) => node.type === "Invoice")
            .sort((a, b) => a.businessKey.localeCompare(b.businessKey));
    }, [graph]);

    // Derive the effective invoice selection during render instead of
    // synchronizing it in an effect — falls back to the first invoice on
    // file whenever no explicit (or now-stale) selection exists yet.
    const effectiveInvoiceId = useMemo(() => {
        if (
            selectedInvoiceId &&
            invoiceNodes.some((invoice) => invoice.id === selectedInvoiceId)
        ) {
            return selectedInvoiceId;
        }
        return invoiceNodes[0]?.id;
    }, [invoiceNodes, selectedInvoiceId]);

    const invoiceView = useMemo(() => {
        if (!graph || !effectiveInvoiceId) return undefined;
        return buildInvoiceView(effectiveInvoiceId, graph.nodes, graph.edges);
    }, [graph, effectiveInvoiceId]);

    // Likewise, derive the effective node selection — falls back to the
    // invoice itself whenever no node is selected, or the previous
    // selection belonged to a different invoice's relationship set.
    const effectiveNodeId = useMemo(() => {
        if (!invoiceView) return undefined;
        if (
            selectedNodeId &&
            invoiceView.nodes.some((node) => node.id === selectedNodeId)
        ) {
            return selectedNodeId;
        }
        return invoiceView.invoice.id;
    }, [invoiceView, selectedNodeId]);

    const metrics = useMemo(
        () => (graph ? getGraphMetrics(graph.nodes, graph.edges) : undefined),
        [graph],
    );

    const selectedNode =
        invoiceView?.nodes.find((node) => node.id === effectiveNodeId) ??
        invoiceView?.invoice;

    const openServiceCaseCount = invoiceView
        ? invoiceView.serviceCases.filter(
              (serviceCase) =>
                  getStringProperty(serviceCase, "status")?.toLowerCase() === "open",
          ).length
        : 0;

    const kpiItems: KpiCardItem[] = invoiceView
        ? [
              {
                  key: "connected",
                  label: "Connected records",
                  value: (invoiceView.nodes.length - 1).toLocaleString("en-US"),
                  hint: "Entities linked to this invoice",
                  icon: Waypoints,
              },
              {
                  key: "paths",
                  label: "Relationship paths",
                  value: invoiceView.edges.length.toLocaleString("en-US"),
                  hint: "Directed edges traced in the graph",
                  icon: Route,
              },
              {
                  key: "amount",
                  label: "Invoice amount",
                  value: formatCurrency(
                      getNumberProperty(invoiceView.invoice, "totalAmount"),
                  ),
                  hint: getStringProperty(invoiceView.invoice, "status")
                      ? `Status: ${getStringProperty(invoiceView.invoice, "status")}`
                      : "Status unavailable",
                  icon: Banknote,
              },
              {
                  key: "cases",
                  label: "Open service cases",
                  value: openServiceCaseCount.toLocaleString("en-US"),
                  hint:
                      openServiceCaseCount === 0
                          ? "No active escalations"
                          : "Needs investigator attention",
                  icon: ShieldAlert,
              },
          ]
        : [];

    const handleRetry = () => {
        nodesQuery.refetch();
        edgesQuery.refetch();
    };

    const isLive = Boolean(graph) && !errorMessage;

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
            <RelationshipLensHeader
                isDark={isDark}
                onToggleTheme={toggleTheme}
                isLive={isLive}
                totalNodes={metrics?.totalNodes ?? 0}
                totalEdges={metrics?.totalEdges ?? 0}
                invoiceCount={metrics?.invoiceCount ?? 0}
            />

            {errorMessage && (
                <GraphErrorBanner message={errorMessage} onRetry={handleRetry} />
            )}

            {isLoading && !graph ? (
                <GraphLoadingSkeleton />
            ) : !errorMessage && graph && invoiceNodes.length === 0 ? (
                <GraphEmptyState />
            ) : invoiceView && selectedNode ? (
                <main className="max-w-dashboard mx-auto w-full flex-1 p-400 sm:p-500">
                    <div className="grid grid-cols-1 gap-400 lg:dashboard-grid lg:items-start">
                        <InvoiceIndexList
                            invoices={invoiceNodes}
                            selectedInvoiceId={effectiveInvoiceId}
                            onSelect={setSelectedInvoiceId}
                        />

                        <div className="flex flex-col gap-400">
                            <KpiRow items={kpiItems} />
                            <GraphNarrative summary={invoiceView.summary} />

                            <div className="grid grid-cols-1 gap-400 xl:investigation-grid">
                                <div className="rounded-xl border border-border bg-card p-400 shadow-4">
                                    <h2 className="mb-300 font-heading text-400 leading-400 text-card-foreground">
                                        Relationship map
                                    </h2>
                                    <RelationshipMap
                                        view={invoiceView}
                                        selectedNodeId={effectiveNodeId ?? invoiceView.invoice.id}
                                        onSelectNode={setSelectedNodeId}
                                    />
                                </div>
                                <NodeDetailsPanel
                                    node={selectedNode}
                                    isInvoice={selectedNode.id === invoiceView.invoice.id}
                                />
                            </div>

                            <RelatedRecordsPanel
                                view={invoiceView}
                                selectedNodeId={effectiveNodeId ?? invoiceView.invoice.id}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    </div>
                </main>
            ) : null}
        </div>
    );
}

export default App;
