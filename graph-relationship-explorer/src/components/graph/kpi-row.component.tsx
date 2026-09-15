//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { LucideIcon } from "lucide-react";

export interface KpiCardItem {
    key: string;
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
}

interface KpiRowProps {
    items: KpiCardItem[];
}

/** Top-of-page KPI strip summarizing the currently selected invoice's footprint. */
export function KpiRow({ items }: KpiRowProps) {
    return (
        <div className="grid grid-cols-2 gap-300 lg:grid-cols-4">
            {items.map(({ key, label, value, hint, icon: Icon }) => (
                <div
                    key={key}
                    className="flex flex-col gap-200 rounded-xl border border-border bg-card p-400 shadow-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-200 font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                        </span>
                        <Icon className="icon-size-300 text-primary" aria-hidden="true" />
                    </div>
                    <p className="font-numeric text-hero-700 leading-hero-700 text-card-foreground">
                        {value}
                    </p>
                    <p className="text-200 text-muted-foreground">{hint}</p>
                </div>
            ))}
        </div>
    );
}
