//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import type { GraphNode, InvoiceView } from "@/lib/graph-data";
import { cn } from "@/lib/utils";

import { getNodeVisual } from "./node-visuals";

interface RelatedRecordsPanelProps {
    view: InvoiceView;
    selectedNodeId: string;
    onSelectNode: (nodeId: string) => void;
}

/**
 * Semantic-HTML mirror of the relationship map: every connected record grouped
 * by how it links back to the invoice, forming a readable relationship trail.
 */
export function RelatedRecordsPanel({
    view,
    selectedNodeId,
    onSelectNode,
}: RelatedRecordsPanelProps) {
    const lineToProducts = view.orderLines.map((line) => ({
        line,
        products: view.edges
            .filter(
                (edge) =>
                    edge.relationshipType === "REFERENCES" &&
                    edge.sourceNodeId === line.id,
            )
            .map((edge) =>
                view.products.find((product) => product.id === edge.targetNodeId),
            )
            .filter((product): product is GraphNode => product !== undefined),
    }));

    return (
        <section
            aria-label="Related records"
            className="flex flex-col gap-400 rounded-xl border border-border bg-card p-400 shadow-4"
        >
            <header>
                <h2 className="font-heading text-400 leading-400 text-card-foreground">
                    Relationship trail
                </h2>
                <p className="text-200 text-muted-foreground">
                    Every record connected to this invoice, grouped by how it links back.
                </p>
            </header>

            <TrailGroup title="Invoice → Order → Account">
                <div className="flex flex-wrap items-center gap-200">
                    <RecordChip
                        node={view.invoice}
                        isSelected={selectedNodeId === view.invoice.id}
                        onSelect={onSelectNode}
                    />
                    {view.order && (
                        <>
                            <ChevronRight
                                className="icon-size-200 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <RecordChip
                                node={view.order}
                                isSelected={selectedNodeId === view.order.id}
                                onSelect={onSelectNode}
                            />
                        </>
                    )}
                    {view.account && (
                        <>
                            <ChevronRight
                                className="icon-size-200 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <RecordChip
                                node={view.account}
                                isSelected={selectedNodeId === view.account.id}
                                onSelect={onSelectNode}
                            />
                        </>
                    )}
                </div>
            </TrailGroup>

            {view.orderLines.length > 0 && (
                <TrailGroup title="Order → Order lines → Products">
                    <div className="flex flex-col gap-200">
                        {lineToProducts.map(({ line, products }) => (
                            <div
                                key={line.id}
                                className="flex flex-wrap items-center gap-200"
                            >
                                <RecordChip
                                    node={line}
                                    isSelected={selectedNodeId === line.id}
                                    onSelect={onSelectNode}
                                />
                                {products.map((product) => (
                                    <span
                                        key={product.id}
                                        className="flex items-center gap-200"
                                    >
                                        <ChevronRight
                                            className="icon-size-200 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <RecordChip
                                            node={product}
                                            isSelected={selectedNodeId === product.id}
                                            onSelect={onSelectNode}
                                        />
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </TrailGroup>
            )}

            {view.contacts.length > 0 && (
                <TrailGroup title="Account → Contacts">
                    <div className="flex flex-wrap gap-200">
                        {view.contacts.map((contact) => (
                            <RecordChip
                                key={contact.id}
                                node={contact}
                                isSelected={selectedNodeId === contact.id}
                                onSelect={onSelectNode}
                            />
                        ))}
                    </div>
                </TrailGroup>
            )}

            {view.serviceCases.length > 0 && (
                <TrailGroup title="Account → Service cases">
                    <div className="flex flex-wrap gap-200">
                        {view.serviceCases.map((serviceCase) => (
                            <RecordChip
                                key={serviceCase.id}
                                node={serviceCase}
                                isSelected={selectedNodeId === serviceCase.id}
                                onSelect={onSelectNode}
                            />
                        ))}
                    </div>
                </TrailGroup>
            )}
        </section>
    );
}

function TrailGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-200">
            <h3 className="text-200 font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
            </h3>
            {children}
        </div>
    );
}

interface RecordChipProps {
    node: GraphNode;
    isSelected: boolean;
    onSelect: (nodeId: string) => void;
}

function RecordChip({ node, isSelected, onSelect }: RecordChipProps) {
    const visual = getNodeVisual(node.type);
    const Icon = visual.icon;

    return (
        <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-pressed={isSelected}
            className={cn(
                "flex items-center gap-200 rounded-lg border px-300 py-200 text-left transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isSelected
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-secondary/40 hover:border-accent/50 hover:bg-accent/10",
            )}
        >
            <Icon className="icon-size-300 shrink-0 text-accent" aria-hidden="true" />
            <span className="flex flex-col">
                <span className="text-300 font-medium text-card-foreground">
                    {node.label}
                </span>
                <span className="font-monospace text-100 text-muted-foreground">
                    {node.businessKey}
                </span>
            </span>
        </button>
    );
}
