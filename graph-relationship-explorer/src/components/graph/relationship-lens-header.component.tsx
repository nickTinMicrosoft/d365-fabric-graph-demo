//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Moon, Radio, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

interface RelationshipLensHeaderProps {
    isDark: boolean;
    onToggleTheme: () => void;
    /** True once the graph has loaded successfully and no error is present. */
    isLive: boolean;
    totalNodes: number;
    totalEdges: number;
    invoiceCount: number;
}

export function RelationshipLensHeader({
    isDark,
    onToggleTheme,
    isLive,
    totalNodes,
    totalEdges,
    invoiceCount,
}: RelationshipLensHeaderProps) {
    return (
        <header className="flex flex-col gap-300 border-b border-border bg-card/80 px-400 py-400 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-500">
            <div>
                <p className="tracking-brand text-200 font-semibold uppercase text-muted-foreground">
                    Fabric · Dataverse Graph
                </p>
                <h1 className="font-heading text-hero-800 italic leading-hero-800 text-foreground">
                    Relationship Lens
                </h1>
                <p className="max-w-prose text-300 leading-400 text-muted-foreground">
                    Trace how every invoice connects to its order, account, contacts,
                    products, and service history — live from the graph.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-300">
                <div
                    className={cn(
                        "flex items-center gap-200 rounded-full border px-300 py-100 text-200 font-semibold uppercase tracking-wide",
                        isLive
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-border bg-muted text-muted-foreground",
                    )}
                    role="status"
                >
                    <Radio
                        className={cn("icon-size-200", isLive && "lens-heartbeat")}
                        aria-hidden="true"
                    />
                    <span>{isLive ? "Live" : "Offline"}</span>
                </div>

                {isLive && (
                    <p className="hidden text-200 text-muted-foreground lg:block">
                        {invoiceCount} invoice case{invoiceCount === 1 ? "" : "s"} ·{" "}
                        {totalNodes} entities · {totalEdges} relationships mapped
                    </p>
                )}

                <button
                    type="button"
                    onClick={onToggleTheme}
                    aria-pressed={isDark}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    )}
                >
                    {isDark ? (
                        <Sun className="icon-size-300" aria-hidden="true" />
                    ) : (
                        <Moon className="icon-size-300" aria-hidden="true" />
                    )}
                </button>
            </div>
        </header>
    );
}
