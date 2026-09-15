//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { GraphNode } from "@/lib/graph-data";
import { cn } from "@/lib/utils";

import { formatPropertyValue, humanizeKey } from "./format-property";
import { getNodeVisual } from "./node-visuals";

interface NodeDetailsPanelProps {
    node: GraphNode;
    isInvoice: boolean;
}

/** Details panel that mirrors the currently selected relationship-map node in semantic HTML. */
export function NodeDetailsPanel({ node, isInvoice }: NodeDetailsPanelProps) {
    const visual = getNodeVisual(node.type);
    const Icon = visual.icon;
    const propertyEntries = Object.entries(node.properties);

    return (
        <section
            aria-label="Selected record details"
            className="flex h-full flex-col gap-400 rounded-xl border border-border bg-card p-400 shadow-4"
        >
            <header className="flex items-start justify-between gap-300 border-b border-border pb-300">
                <div className="flex items-center gap-300">
                    <span
                        className={cn(
                            "flex icon-size-700 items-center justify-center rounded-lg",
                            isInvoice
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent/15 text-accent",
                        )}
                    >
                        <Icon className="icon-size-400" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="text-200 font-semibold uppercase tracking-wide text-muted-foreground">
                            {visual.badge}
                        </p>
                        <h3 className="font-heading text-500 leading-500 text-card-foreground">
                            {node.label}
                        </h3>
                    </div>
                </div>
                {isInvoice && (
                    <span className="whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-300-nudge py-100-nudge text-100 font-semibold uppercase tracking-wide text-primary">
                        Center of inquiry
                    </span>
                )}
            </header>

            <dl className="grid grid-cols-1 gap-300 text-300 sm:grid-cols-2">
                <div>
                    <dt className="text-200 text-muted-foreground">Business key</dt>
                    <dd className="font-monospace text-300 text-card-foreground">
                        {node.businessKey}
                    </dd>
                </div>
                <div>
                    <dt className="text-200 text-muted-foreground">Node type</dt>
                    <dd className="text-300 text-card-foreground">{node.type}</dd>
                </div>
            </dl>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/40 p-300">
                <h4 className="mb-200 text-200 font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidence properties
                </h4>
                {propertyEntries.length === 0 ? (
                    <p className="text-300 text-muted-foreground">
                        No additional properties recorded.
                    </p>
                ) : (
                    <dl className="grid grid-cols-1 gap-200-nudge">
                        {propertyEntries.map(([key, value]) => (
                            <div
                                key={key}
                                className="flex items-baseline justify-between gap-300 border-b border-border/60 pb-100-nudge"
                            >
                                <dt className="text-200 text-muted-foreground">
                                    {humanizeKey(key)}
                                </dt>
                                <dd className="text-right font-numeric text-300 text-card-foreground">
                                    {formatPropertyValue(value)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </section>
    );
}
