import React, { useMemo } from "react";
import type { TopologyNode, TopologyEdge } from "@/data/scenarios";
import { TopologyNodeIcon } from "@/components/TopologyNodeIcon";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Props {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  nodeStates: Map<string, TopologyNode["status"]>;
  affectedNodes: string[];
  onNodePositionChange?: (id: string, x: number, y: number) => void;
}

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

export const TopologyMap: React.FC<Props> = ({ nodes, edges, nodeStates, affectedNodes, onNodePositionChange }) => {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const titleId = "system-topology-title";
  const summaryId = "system-topology-summary";
  const instructionsId = "system-topology-instructions";
  const criticalPulse = prefersReducedMotion
    ? { duration: "4s", opacity: "0.2;0.36;0.2" }
    : { duration: "2s", radius: "28;36;28", opacity: "0.5;0.2;0.5" };
  const degradedPulse = prefersReducedMotion
    ? { duration: "5s", opacity: "0.16;0.28;0.16" }
    : { duration: "3s", radius: "26;32;26", opacity: "0.4;0.15;0.4" };

  // Convert screen coordinates to SVG coordinates
  const screenToSvg = React.useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return null;
    const svgPt = pt.matrixTransform(screenCTM.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleMouseDown = React.useCallback((e: React.MouseEvent, node: TopologyNode) => {
    if (!onNodePositionChange) return;
    setDragging(node.id);
    e.preventDefault();
  }, [onNodePositionChange]);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    const drag = dragging;
    if (!drag || !onNodePositionChange) return;
    const svgCoords = screenToSvg(e.clientX, e.clientY);
    if (!svgCoords) return;
    onNodePositionChange(drag, svgCoords.x, svgCoords.y);
  }, [dragging, onNodePositionChange, screenToSvg]);

  const handleMouseUp = React.useCallback(() => {
    setDragging(null);
  }, []);

  const handleTouchStart = React.useCallback((e: React.TouchEvent, node: TopologyNode) => {
    if (!onNodePositionChange) return;
    setDragging(node.id);
    e.preventDefault();
  }, [onNodePositionChange]);

  const handleTouchMove = React.useCallback((e: TouchEvent) => {
    const drag = dragging;
    if (!drag || !onNodePositionChange) return;
    const touch = e.touches[0];
    const svgCoords = screenToSvg(touch.clientX, touch.clientY);
    if (!svgCoords) return;
    onNodePositionChange(drag, svgCoords.x, svgCoords.y);
  }, [dragging, onNodePositionChange, screenToSvg]);

  const handleTouchEnd = React.useCallback(() => {
    setDragging(null);
  }, []);

  const handleKeyboardMove = React.useCallback(
    (event: React.KeyboardEvent<SVGGElement>, node: TopologyNode) => {
      if (!onNodePositionChange) return;

      const step = event.shiftKey ? 24 : 8;
      const movementByKey: Partial<Record<string, { x: number; y: number }>> = {
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
      };
      const movement = movementByKey[event.key];

      if (!movement) return;

      event.preventDefault();
      onNodePositionChange(node.id, node.x + movement.x, node.y + movement.y);
    },
    [onNodePositionChange],
  );

  // Global move/end listeners
  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

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
    <section
      className="glass-panel flex h-full flex-col p-4"
      aria-labelledby={titleId}
      aria-describedby={`${summaryId} ${instructionsId}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <h3 id={titleId} className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
          System Topology
        </h3>
      </div>
      <p id={summaryId} className="sr-only">
        Topology view with {nodes.length} nodes and {edges.length} connections. {affectedNodes.length} nodes are currently affected.
      </p>
      <p id={instructionsId} className="sr-only">
        {onNodePositionChange
          ? "Use Tab to focus a node. Use the arrow keys to move the focused node, or hold Shift with the arrow keys to move it faster."
          : "Use Tab to focus a node and hear its current status and connections."}
      </p>
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="flex-1 w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={`${summaryId} ${instructionsId}`}
      >
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
                {isAffected && !prefersReducedMotion && (
                  <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1s" repeatCount="indefinite" />
                )}
              </line>

              {/* Propagation particles - multiple particles per affected edge */}
              {isAffected && !prefersReducedMotion && (
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
              {isDegraded && !isAffected && !prefersReducedMotion && (
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
          const connectedEdges = edges.filter(
            (edge) => edge.from === node.id || edge.to === node.id,
          ).length;
          const isKeyboardFocusable = dragging == null || dragging === node.id;

          return (
            <g
              key={node.id}
              style={{ cursor: onNodePositionChange ? "grab" : undefined }}
              tabIndex={isKeyboardFocusable ? 0 : -1}
              focusable="true"
              role={onNodePositionChange ? "button" : "img"}
              aria-label={
                onNodePositionChange
                  ? `${node.label}, ${status} status, ${connectedEdges} connections. Use arrow keys to reposition this node.`
                  : `${node.label}, ${status} status, ${connectedEdges} connections.`
              }
              aria-keyshortcuts={onNodePositionChange ? "ArrowUp ArrowDown ArrowLeft ArrowRight" : undefined}
              onKeyDown={(event) => handleKeyboardMove(event, node)}
              onFocus={() => setFocusedNodeId(node.id)}
              onBlur={() =>
                setFocusedNodeId((currentFocusedNodeId) =>
                  currentFocusedNodeId === node.id ? null : currentFocusedNodeId,
                )
              }
            >
              {/* Pulse ring for affected */}
              {(status === "down" || isAffected) && (
                <circle cx={node.x} cy={node.y} r={32} className="fill-none stroke-severity-critical/30" strokeWidth={2} filter="url(#glow-critical)">
                  {criticalPulse.radius ? (
                    <animate attributeName="r" values={criticalPulse.radius} dur={criticalPulse.duration} repeatCount="indefinite" />
                  ) : null}
                  <animate attributeName="opacity" values={criticalPulse.opacity} dur={criticalPulse.duration} repeatCount="indefinite" />
                </circle>
              )}
              {status === "degraded" && (
                <circle cx={node.x} cy={node.y} r={30} className="fill-none stroke-severity-medium/30" strokeWidth={1.5}>
                  {degradedPulse.radius ? (
                    <animate attributeName="r" values={degradedPulse.radius} dur={degradedPulse.duration} repeatCount="indefinite" />
                  ) : null}
                  <animate attributeName="opacity" values={degradedPulse.opacity} dur={degradedPulse.duration} repeatCount="indefinite" />
                </circle>
              )}
              {focusedNodeId === node.id ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={29}
                  className="fill-none stroke-primary"
                  strokeWidth={2}
                />
              ) : null}

              {/* Main circle with drag events */}
              <circle
                cx={node.x}
                cy={node.y}
                r={24}
                className={`${statusFillColors[status]} ${statusColors[status]}`}
                strokeWidth={2}
                filter={status !== "healthy" ? "url(#glow)" : undefined}
                onMouseDown={onNodePositionChange ? (e) => handleMouseDown(e, node) : undefined}
                onTouchStart={onNodePositionChange ? (e) => handleTouchStart(e, node) : undefined}
                style={{ cursor: onNodePositionChange ? "grab" : undefined }}
              />

              {/* Icon */}
              <g transform={`translate(${node.x - 9} ${node.y - 9})`} pointerEvents="none">
                <TopologyNodeIcon
                  type={node.type}
                  size={18}
                  strokeWidth={status === "healthy" ? 1.9 : 2.1}
                  className={
                    status === "down"
                      ? "text-severity-critical"
                      : status === "degraded"
                      ? "text-severity-medium"
                      : status === "unknown"
                      ? "text-muted-foreground"
                      : undefined
                  }
                />
              </g>

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
    </section>
  );
};
