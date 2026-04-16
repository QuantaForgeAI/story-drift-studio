import React, { useMemo } from "react";
import type { TopologyNode, TopologyEdge } from "@/data/scenarios";

interface Props {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  nodeStates: Map<string, TopologyNode["status"]>;
  affectedNodes: string[];
}

const typeIcons: Record<TopologyNode["type"], string> = {
  service: "⚙",
  database: "🗄",
  gateway: "🌐",
  queue: "📨",
  cache: "⚡",
  external: "☁",
};

const statusColors: Record<TopologyNode["status"], string> = {
  healthy: "stroke-severity-low",
  degraded: "stroke-severity-medium",
  down: "stroke-severity-critical",
  unknown: "stroke-muted-foreground",
};

const statusFillColors: Record<TopologyNode["status"], string> = {
  healthy: "fill-severity-low/20",
  degraded: "fill-severity-medium/20",
  down: "fill-severity-critical/20",
  unknown: "fill-muted/20",
};

export const TopologyMap: React.FC<Props> = ({ nodes, edges, nodeStates, affectedNodes }) => {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">System Topology</h3>
      </div>
      <svg viewBox="0 0 800 400" className="flex-1 w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-critical">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const fromStatus = nodeStates.get(from.id) ?? "healthy";
          const toStatus = nodeStates.get(to.id) ?? "healthy";
          const isAffected = fromStatus === "down" || toStatus === "down";
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={isAffected ? "stroke-severity-critical/40" : "stroke-topology-line/50"}
              strokeWidth={isAffected ? 2 : 1}
              strokeDasharray={isAffected ? "6 3" : undefined}
              filter={isAffected ? "url(#glow)" : undefined}
            >
              {isAffected && (
                <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1s" repeatCount="indefinite" />
              )}
            </line>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const status = nodeStates.get(node.id) ?? node.status;
          const isAffected = affectedNodes.includes(node.id);
          return (
            <g key={node.id}>
              {/* Pulse ring for affected */}
              {(status === "down" || isAffected) && (
                <circle cx={node.x} cy={node.y} r={32} className="fill-none stroke-severity-critical/30" strokeWidth={2} filter="url(#glow-critical)">
                  <animate attributeName="r" values="28;36;28" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {status === "degraded" && (
                <circle cx={node.x} cy={node.y} r={30} className="fill-none stroke-severity-medium/30" strokeWidth={1.5}>
                  <animate attributeName="r" values="26;32;26" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.15;0.4" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Main circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={24}
                className={`${statusFillColors[status]} ${statusColors[status]}`}
                strokeWidth={2}
                filter={status !== "healthy" ? "url(#glow)" : undefined}
              />

              {/* Icon */}
              <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="central" className="text-sm select-none" fontSize="14">
                {typeIcons[node.type]}
              </text>

              {/* Label */}
              <text
                x={node.x}
                y={node.y + 42}
                textAnchor="middle"
                className="fill-foreground/70 font-body"
                fontSize="10"
                fontWeight="500"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
