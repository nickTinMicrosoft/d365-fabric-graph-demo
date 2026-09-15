//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    Building2,
    ClipboardList,
    CircleQuestionMark,
    LifeBuoy,
    Package,
    Rows3,
    ScrollText,
    UserRound,
    type LucideIcon,
} from "lucide-react";

/** Node type strings produced by the graph model (`GraphNode.type`). */
export type GraphNodeTypeName =
    | "Invoice"
    | "Order"
    | "Account"
    | "Contact"
    | "OrderLine"
    | "Product"
    | "ServiceCase";

export interface NodeVisual {
    /** Icon representing this record type across the map, details panel, and trails. */
    icon: LucideIcon;
    /** Human-readable badge label for this record type. */
    badge: string;
    /**
     * Clockwise anchor angle (degrees, 0 = north/top) used to position this
     * category around the invoice at the center of the relationship map.
     */
    angle: number;
    /** True for the two records one hop from the invoice (Order, Account). */
    isHub: boolean;
}

const REGISTRY: Record<GraphNodeTypeName, NodeVisual> = {
    Invoice: { icon: ScrollText, badge: "Invoice", angle: 0, isHub: false },
    Order: { icon: ClipboardList, badge: "Order", angle: 0, isHub: true },
    OrderLine: { icon: Rows3, badge: "Order line", angle: 60, isHub: false },
    Product: { icon: Package, badge: "Product", angle: 120, isHub: false },
    ServiceCase: { icon: LifeBuoy, badge: "Service case", angle: 180, isHub: false },
    Account: { icon: Building2, badge: "Account", angle: 240, isHub: true },
    Contact: { icon: UserRound, badge: "Contact", angle: 300, isHub: false },
};

const FALLBACK: NodeVisual = {
    icon: CircleQuestionMark,
    badge: "Record",
    angle: 300,
    isHub: false,
};

/** Looks up the icon, label, and radial map position for a node's type. */
export function getNodeVisual(type: string): NodeVisual {
    return REGISTRY[type as GraphNodeTypeName] ?? FALLBACK;
}
