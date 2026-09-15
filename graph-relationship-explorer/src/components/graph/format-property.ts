//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

const ISO_DATE_PATTERN =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Converts a camelCase / snake_case property key into a readable label. */
export function humanizeKey(key: string): string {
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim();
    const lower = spaced.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Formats an arbitrary node-property value for display in the details panel. */
export function formatPropertyValue(value: unknown): string {
    if (value === null || value === undefined || value === "") {
        return "Not recorded";
    }
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value.toLocaleString("en-US") : "Not recorded";
    }
    if (typeof value === "string") {
        if (ISO_DATE_PATTERN.test(value)) {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                    parsed,
                );
            }
        }
        return value;
    }
    return JSON.stringify(value);
}
