//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useRef } from "react";
import { FolderOpen } from "lucide-react";

import {
    formatCurrency,
    getNumberProperty,
    getStringProperty,
    type GraphNode,
} from "@/lib/graph-data";
import { cn } from "@/lib/utils";

interface InvoiceIndexListProps {
    invoices: GraphNode[];
    selectedInvoiceId?: string;
    onSelect: (invoiceId: string) => void;
}

/** Left-column master list of every invoice discovered in the live graph. */
export function InvoiceIndexList({
    invoices,
    selectedInvoiceId,
    onSelect,
}: InvoiceIndexListProps) {
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const focusItem = (index: number) => {
        if (invoices.length === 0) return;
        const clamped = (index + invoices.length) % invoices.length;
        itemRefs.current[clamped]?.focus();
    };

    return (
        <nav
            aria-label="Invoice case index"
            className="flex h-full flex-col gap-300 rounded-xl border border-border bg-card p-400 shadow-4 lg:sticky lg:top-500 lg:max-h-invoice-index"
        >
            <div className="flex items-center gap-200 border-b border-border pb-300">
                <FolderOpen className="icon-size-400 text-accent" aria-hidden="true" />
                <div>
                    <h2 className="font-heading text-400 leading-400 text-card-foreground">
                        Case Index
                    </h2>
                    <p className="text-200 text-muted-foreground">
                        {invoices.length} invoice{invoices.length === 1 ? "" : "s"} on file
                    </p>
                </div>
            </div>

            <ul
                className="flex min-h-0 flex-1 flex-col gap-200 overflow-auto"
                role="listbox"
                aria-label="Invoices"
            >
                {invoices.map((invoice, index) => {
                    const isSelected = invoice.id === selectedInvoiceId;
                    const status = getStringProperty(invoice, "status") ?? "Unknown";
                    const amount = formatCurrency(
                        getNumberProperty(invoice, "totalAmount"),
                    );
                    return (
                        <li key={invoice.id} role="presentation">
                            <button
                                ref={(element) => {
                                    itemRefs.current[index] = element;
                                }}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => onSelect(invoice.id)}
                                onKeyDown={(event) => {
                                    if (event.key === "ArrowDown") {
                                        event.preventDefault();
                                        focusItem(index + 1);
                                    }
                                    if (event.key === "ArrowUp") {
                                        event.preventDefault();
                                        focusItem(index - 1);
                                    }
                                }}
                                className={cn(
                                    "flex w-full flex-col gap-100 rounded-lg border px-300 py-300 text-left transition-colors",
                                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                    isSelected
                                        ? "border-primary/50 bg-primary/10"
                                        : "border-transparent bg-secondary/40 hover:border-border hover:bg-accent/10",
                                )}
                            >
                                <span className="flex items-center justify-between gap-200">
                                    <span className="font-monospace text-200 text-muted-foreground">
                                        {invoice.businessKey}
                                    </span>
                                    <span
                                        className={cn(
                                            "rounded-full px-200-nudge py-100-nudge text-100 font-semibold uppercase tracking-wide",
                                            statusToneClass(status),
                                        )}
                                    >
                                        {status}
                                    </span>
                                </span>
                                <span className="font-heading text-400 leading-400 text-card-foreground">
                                    {invoice.label}
                                </span>
                                <span className="font-numeric text-300 text-muted-foreground">
                                    {amount}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

function statusToneClass(status: string): string {
    const normalized = status.toLowerCase();
    if (/(open|overdue|pending|past due|escalat)/.test(normalized)) {
        return "bg-destructive/15 text-destructive";
    }
    if (/(paid|closed|resolved|complete|settled)/.test(normalized)) {
        return "bg-success/15 text-success";
    }
    return "bg-accent/15 text-accent";
}
