//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useId, useMemo } from "react";

import type { GraphEdge, GraphNode, InvoiceView } from "@/lib/graph-data";
import { cn } from "@/lib/utils";

import { getNodeVisual } from "./node-visuals";

interface RelationshipMapProps {
    view: InvoiceView;
    selectedNodeId: string;
    onSelectNode: (nodeId: string) => void;
}

interface PositionedNode {
    node: GraphNode;
    x: number;
    y: number;
    radius: number;
}

const VIEWBOX = 520;
const CENTER = VIEWBOX / 2;
const RING_RADIUS = 175;
const SECTOR_SPAN = 44;
const HUB_RADIUS = 24;
const LEAF_RADIUS = 18;
const INVOICE_RADIUS = 32;

function polarPoint(angleDeg: number, radius: number) {
    // 0deg = north/top, increasing clockwise — a compass, not a math circle.
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: CENTER + radius * Math.cos(angleRad),
        y: CENTER + radius * Math.sin(angleRad),
    };
}

function layoutCategory(
    nodes: readonly GraphNode[],
    anchorAngle: number,
    nodeRadius: number,
): PositionedNode[] {
    if (nodes.length === 0) return [];
    if (nodes.length === 1) {
        const { x, y } = polarPoint(anchorAngle, RING_RADIUS);
        return [{ node: nodes[0], x, y, radius: nodeRadius }];
    }
    const start = anchorAngle - SECTOR_SPAN / 2;
    return nodes.map((node, index) => {
        const angle = start + (SECTOR_SPAN * (index + 0.5)) / nodes.length;
        const radius = RING_RADIUS + (index % 2 === 1 ? 44 : 0);
        const { x, y } = polarPoint(angle, radius);
        return { node, x, y, radius: nodeRadius };
    });
}

function buildAdjacency(edges: readonly GraphEdge[]) {
    const adjacency = new Map<string, { neighbor: string; edgeId: string }[]>();
    const link = (from: string, to: string, edgeId: string) => {
        if (!adjacency.has(from)) adjacency.set(from, []);
        adjacency.get(from)!.push({ neighbor: to, edgeId });
    };
    for (const edge of edges) {
        link(edge.sourceNodeId, edge.targetNodeId, edge.id);
        link(edge.targetNodeId, edge.sourceNodeId, edge.id);
    }
    return adjacency;
}

/** Traces the unique path (as a set of edge IDs) from the invoice to any selected node. */
function findPathEdgeIds(
    rootId: string,
    targetId: string,
    edges: readonly GraphEdge[],
): Set<string> {
    if (rootId === targetId) return new Set();
    const adjacency = buildAdjacency(edges);
    const visited = new Set([rootId]);
    const parent = new Map<string, { from: string; edgeId: string }>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === targetId) break;
        for (const { neighbor, edgeId } of adjacency.get(current) ?? []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                parent.set(neighbor, { from: current, edgeId });
                queue.push(neighbor);
            }
        }
    }

    const path = new Set<string>();
    let cursor = targetId;
    while (parent.has(cursor)) {
        const step = parent.get(cursor)!;
        path.add(step.edgeId);
        cursor = step.from;
    }
    return path;
}

function humanizeRelationship(type: string): string {
    return type
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function truncateLabel(label: string, max = 16): string {
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * A custom, dependency-free SVG relationship map: the selected invoice glows
 * at the center, with its Order, Account, Contact, Product, Order Line, and
 * Service Case records arranged around it like points on a radar sweep.
 * Selecting any node lights up the unique path back to the invoice.
 */
export function RelationshipMap({
    view,
    selectedNodeId,
    onSelectNode,
}: RelationshipMapProps) {
    const uid = useId();

    const positioned = useMemo<PositionedNode[]>(() => {
        return [
            { node: view.invoice, x: CENTER, y: CENTER, radius: INVOICE_RADIUS },
            ...layoutCategory(
                view.order ? [view.order] : [],
                getNodeVisual("Order").angle,
                HUB_RADIUS,
            ),
            ...layoutCategory(
                view.orderLines,
                getNodeVisual("OrderLine").angle,
                LEAF_RADIUS,
            ),
            ...layoutCategory(
                view.products,
                getNodeVisual("Product").angle,
                LEAF_RADIUS,
            ),
            ...layoutCategory(
                view.serviceCases,
                getNodeVisual("ServiceCase").angle,
                LEAF_RADIUS,
            ),
            ...layoutCategory(
                view.account ? [view.account] : [],
                getNodeVisual("Account").angle,
                HUB_RADIUS,
            ),
            ...layoutCategory(
                view.contacts,
                getNodeVisual("Contact").angle,
                LEAF_RADIUS,
            ),
        ];
    }, [view]);

    const positionById = useMemo(
        () => new Map(positioned.map((entry) => [entry.node.id, entry])),
        [positioned],
    );

    const highlightedEdgeIds = useMemo(
        () => findPathEdgeIds(view.invoice.id, selectedNodeId, view.edges),
        [view, selectedNodeId],
    );

    const arrowMarkerId = `${uid}-arrow`;
    const arrowActiveMarkerId = `${uid}-arrow-active`;
    const glowFilterId = `${uid}-glow`;

    return (
        <div className="max-w-graph mx-auto w-full">
            <svg
                viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
                role="group"
                aria-label={`Relationship map centered on invoice ${view.invoice.label}. Select a node to trace its path back to the invoice.`}
                className="h-full w-full overflow-visible"
            >
                <defs>
                    <marker
                        id={arrowMarkerId}
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <path d="M0,0 L8,4 L0,8 Z" className="fill-border" />
                    </marker>
                    <marker
                        id={arrowActiveMarkerId}
                        markerWidth="9"
                        markerHeight="9"
                        refX="8"
                        refY="4.5"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <path d="M0,0 L9,4.5 L0,9 Z" className="fill-primary" />
                    </marker>
                    <filter id={glowFilterId} x="-80%" y="-80%" width="260%" height="260%">
                        <feGaussianBlur stdDeviation="4.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {view.edges.map((edge) => {
                    const from = positionById.get(edge.sourceNodeId);
                    const to = positionById.get(edge.targetNodeId);
                    if (!from || !to) return null;

                    const active = highlightedEdgeIds.has(edge.id);
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2;
                    const rawAngle =
                        (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
                    const labelAngle =
                        rawAngle > 90 || rawAngle < -90 ? rawAngle + 180 : rawAngle;

                    return (
                        <g key={edge.id}>
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                className={active ? "stroke-primary" : "stroke-border"}
                                strokeWidth={active ? 2.5 : 1}
                                strokeOpacity={active ? 0.95 : 0.6}
                                markerEnd={`url(#${active ? arrowActiveMarkerId : arrowMarkerId})`}
                                filter={active ? `url(#${glowFilterId})` : undefined}
                            />
                            <text
                                x={midX}
                                y={midY}
                                dy={-4}
                                transform={`rotate(${labelAngle}, ${midX}, ${midY})`}
                                textAnchor="middle"
                                className={cn(
                                    "select-none text-100 uppercase tracking-wide",
                                    active
                                        ? "fill-primary font-semibold"
                                        : "fill-muted-foreground",
                                )}
                            >
                                {humanizeRelationship(edge.relationshipType)}
                            </text>
                        </g>
                    );
                })}

                {positioned.map(({ node, x, y, radius }) => {
                    const visual = getNodeVisual(node.type);
                    const Icon = visual.icon;
                    const isInvoice = node.id === view.invoice.id;
                    const isSelected = node.id === selectedNodeId;
                    const isHub = visual.isHub;

                    const restFill = isInvoice
                        ? "fill-primary"
                        : isHub
                          ? "fill-accent/25"
                          : "fill-foreground/10";
                    const selectedFill = isInvoice
                        ? "fill-primary"
                        : isHub
                          ? "fill-accent/45"
                          : "fill-foreground/25";
                    const strokeClass = isInvoice || isSelected
                        ? "stroke-primary"
                        : isHub
                          ? "stroke-accent"
                          : "stroke-border";
                    const iconColorClass = isInvoice
                        ? "text-primary-foreground"
                        : isHub
                          ? "text-accent"
                          : "text-foreground";

                    return (
                        <g
                            key={node.id}
                            className="relationship-node cursor-pointer outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                            transform={`translate(${x}, ${y})`}
                            tabIndex={0}
                            role="button"
                            aria-pressed={isSelected}
                            aria-label={`${visual.badge}: ${node.label}, business key ${node.businessKey}`}
                            onClick={() => onSelectNode(node.id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onSelectNode(node.id);
                                }
                            }}
                        >
                            <title>{`${node.label} (${visual.badge}) — ${node.businessKey}`}</title>
                            {isSelected && (
                                <circle
                                    r={radius + 9}
                                    className="fill-none stroke-primary"
                                    strokeWidth={2}
                                    strokeOpacity={0.65}
                                    filter={`url(#${glowFilterId})`}
                                />
                            )}
                            {isInvoice && !isSelected && (
                                <circle
                                    r={radius + 6}
                                    className="lens-heartbeat fill-none stroke-primary"
                                    strokeWidth={1.5}
                                    strokeOpacity={0.5}
                                />
                            )}
                            <circle
                                r={radius}
                                className={cn(isSelected ? selectedFill : restFill, strokeClass)}
                                strokeWidth={isSelected || isInvoice ? 2 : 1.25}
                            />
                            <g
                                transform={`translate(${-radius * 0.42}, ${-radius * 0.42})`}
                                className={iconColorClass}
                            >
                                <Icon width={radius * 0.84} height={radius * 0.84} aria-hidden="true" />
                            </g>
                            <text
                                y={radius + 16}
                                textAnchor="middle"
                                className="select-none fill-foreground text-200 font-medium"
                            >
                                {truncateLabel(node.label)}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <p className="mt-300 text-center text-200 text-muted-foreground">
                Select any record to trace its glowing path back to the invoice.
            </p>
        </div>
    );
}
