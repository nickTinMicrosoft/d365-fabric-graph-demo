//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ScanSearch } from "lucide-react";

interface GraphNarrativeProps {
    summary: string;
}

/** Deterministic, plain-English case note derived entirely from `InvoiceView.summary`. */
export function GraphNarrative({ summary }: GraphNarrativeProps) {
    return (
        <section
            aria-label="Relationship narrative"
            className="relative overflow-hidden rounded-xl border border-border bg-card p-400 shadow-4"
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-300 -top-400 font-heading text-hero-1000 italic text-primary/5"
            >
                &rdquo;
            </span>
            <div className="relative flex items-start gap-300">
                <span className="mt-100-nudge flex icon-size-600 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <ScanSearch className="icon-size-300" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="font-heading text-400 leading-400 text-card-foreground">
                        What this graph tells you
                    </h2>
                    <p className="mt-100 max-w-prose text-300 leading-400 text-card-foreground/90">
                        {summary}
                    </p>
                </div>
            </div>
        </section>
    );
}
