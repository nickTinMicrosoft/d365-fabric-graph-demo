//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { RefreshCw, ScanSearch, TriangleAlert } from "lucide-react";

/** Skeleton placeholder matching the shape of the loaded dashboard. */
export function GraphLoadingSkeleton() {
    return (
        <div
            className="max-w-dashboard mx-auto flex w-full flex-1 flex-col gap-400 p-400 sm:p-500"
            aria-busy="true"
            aria-live="polite"
        >
            <span className="sr-only">Loading the live relationship graph…</span>
            <div className="grid grid-cols-2 gap-300 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-28 animate-pulse rounded-xl bg-accent/15"
                    />
                ))}
            </div>
            <div className="grid flex-1 grid-cols-1 gap-400 lg:dashboard-grid">
                <div className="h-64 animate-pulse rounded-xl bg-accent/15 lg:h-full" />
                <div className="flex flex-col gap-400">
                    <div className="h-20 animate-pulse rounded-xl bg-accent/15" />
                    <div className="grid grid-cols-1 gap-400 xl:investigation-grid">
                        <div className="max-w-graph mx-auto aspect-square w-full animate-pulse rounded-full bg-accent/15" />
                        <div className="h-64 animate-pulse rounded-xl bg-accent/15" />
                    </div>
                    <div className="h-40 animate-pulse rounded-xl bg-accent/15" />
                </div>
            </div>
        </div>
    );
}

interface GraphErrorBannerProps {
    message: string;
    onRetry: () => void;
}

/** Destructive-styled banner shown when either query returns an error. */
export function GraphErrorBanner({ message, onRetry }: GraphErrorBannerProps) {
    return (
        <div
            role="alert"
            className="mx-400 mt-400 flex flex-col items-start gap-300 rounded-xl border border-destructive/40 bg-destructive/10 p-400 text-destructive sm:mx-500 sm:flex-row sm:items-center"
        >
            <TriangleAlert className="icon-size-400 shrink-0" aria-hidden="true" />
            <div className="flex-1">
                <p className="font-semibold">The graph couldn&apos;t be loaded</p>
                <p className="text-300">{message}</p>
            </div>
            <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-100 rounded-lg border border-destructive/40 px-300 py-100 text-200 font-semibold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                <RefreshCw className="icon-size-200" aria-hidden="true" />
                Retry
            </button>
        </div>
    );
}

/** Centered muted message shown when the graph loads but contains no invoices. */
export function GraphEmptyState() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-200 p-500 text-center">
            <ScanSearch className="icon-size-700 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-500 text-foreground">
                No relationships on file
            </h2>
            <p className="max-w-prose text-300 text-muted-foreground">
                The graph model returned no invoice records. Once invoices, orders, and
                accounts are connected in the graph, they&apos;ll appear here.
            </p>
        </div>
    );
}
