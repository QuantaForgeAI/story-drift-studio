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

  // Compute which edges are "propagating" (both endpoints not healthy, at least one down/degraded)
  const edgePropagation = useMemo(() => {
    return edges.map((edge) => {
      const fromStatus = nodeStates.get(edge.from) ?? "healthy";
      const toStatus = nodeStates.get(edge.to) ?? "healthy";
      const isAffected = fromStatus === "down" || toStatus === "down";
      const isDegraded = fromStatus === "degraded" || toStatus === "degraded";
      return { edge, isAffected, isDegraded };
    });
  }, [edges, nodeStates]);

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
          <filter id="particle-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gradient for propagation particles */}
          <radialGradient id="particle-critical" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="particle-degraded" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(25 95% 53%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Edges */}
        {edgePropagation.map(({ edge, isAffected, isDegraded }, i) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const pathId = `edge-path-${i}`;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);

          return (
            <g key={i}>
              {/* Define path for particle motion */}
              <path
                id={pathId}
                d={`M${from.x},${from.y} L${to.x},${to.y}`}
                fill="none"
                className="pointer-events-none"
                stroke="none"
              />

              {/* Base edge line */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={
                  isAffected
                    ? "stroke-severity-critical/40"
                    : isDegraded
                    ? "stroke-severity-medium/30"
                    : "stroke-topology-line/50"
                }
                strokeWidth={isAffected ? 2 : 1}
                strokeDasharray={isAffected ? "6 3" : undefined}
                filter={isAffected ? "url(#glow)" : undefined}
              >
                {isAffected && (
                  <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1s" repeatCount="indefinite" />
                )}
              </line>

              {/* Propagation particles - multiple particles per affected edge */}
              {isAffected && (
                <>
                  {[0, 1, 2].map((pi) => (
                    <circle key={pi} r="4" fill="url(#particle-critical)" filter="url(#particle-glow)">
                      <animateMotion dur={`${1.2 + pi * 0.4}s`} repeatCount="indefinite" begin={`${pi * 0.4}s`}>
                        <mpath xlinkHref={`#${pathId}`} />
                      </animateMotion>
                      <animate attributeName="r" values="2;5;2" dur={`${1.2 + pi * 0.4}s`} repeatCount="indefinite" begin={`${pi * 0.4}s`} />
                      <animate attributeName="opacity" values="0.3;1;0.3" dur={`${1.2 + pi * 0.4}s`} repeatCount="indefinite" begin={`${pi * 0.4}s`} />
                    </circle>
                  ))}
                  {/* Glowing trail overlay */}
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="stroke-severity-critical/20"
                    strokeWidth={6}
                    filter="url(#glow-critical)"
                  >
                    <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite" />
                  </line>
                </>
              )}
              {isDegraded && !isAffected && (
                <>
                  {[0, 1].map((pi) => (
                    <circle key={pi} r="3" fill="url(#particle-degraded)" filter="url(#particle-glow)">
                      <animateMotion dur={`${2 + pi * 0.6}s`} repeatCount="indefinite" begin={`${pi * 0.5}s`}>
                        <mpath xlinkHref={`#${pathId}`} />
                      </animateMotion>
                      <animate attributeName="r" values="1.5;3.5;1.5" dur={`${2 + pi * 0.6}s`} repeatCount="indefinite" begin={`${pi * 0.5}s`} />
                      <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${2 + pi * 0.6}s`} repeatCount="indefinite" begin={`${pi * 0.5}s`} />
                    </circle>
                  ))}
                </>
              )}
            </g>
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
