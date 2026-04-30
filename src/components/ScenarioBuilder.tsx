import React, { useState, useCallback } from "react";
import { Plus, Trash2, X, Link2, Zap, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopologyNodeIcon } from "@/components/TopologyNodeIcon";
import type { Scenario, TopologyNode, TopologyEdge, TimelineEvent, Severity } from "@/data/scenarios";
import {
  defaultTopologyNodeType,
  featuredTopologyNodeTypes,
  getTopologyNodeDefinition,
  getTopologyNodeLabel,
  renameDefaultTopologyNodeLabel,
  topologyNodeTypeGroups,
} from "@/lib/topologyNodes";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";

interface Props {
  onSave: (scenario: Scenario) => void;
  onClose: () => void;
}

const eventTypes: TimelineEvent["type"][] = ["drift", "alert", "failure", "recovery", "injection", "cascade"];
const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

const defaultPositions = [
  { x: 400, y: 60 }, { x: 200, y: 180 }, { x: 400, y: 180 }, { x: 600, y: 180 },
  { x: 200, y: 320 }, { x: 400, y: 320 }, { x: 600, y: 320 }, { x: 100, y: 60 },
];

type Step = "meta" | "nodes" | "edges" | "events" | "review";
const steps: { key: Step; label: string }[] = [
  { key: "meta", label: "Scenario" },
  { key: "nodes", label: "Nodes" },
  { key: "edges", label: "Edges" },
  { key: "events", label: "Events" },
  { key: "review", label: "Review" },
];

export const ScenarioBuilder: React.FC<Props> = ({ onSave, onClose }) => {
  const [step, setStep] = useState<Step>("meta");

  // Meta
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("high");
  const [duration, setDuration] = useState(120);

  // Nodes
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [newNodeType, setNewNodeType] = useState<TopologyNode["type"]>(defaultTopologyNodeType);

  // Edges
  const [edges, setEdges] = useState<TopologyEdge[]>([]);

  // Events
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const addNode = useCallback((type: TopologyNode["type"] = newNodeType) => {
    const id = `node-${Date.now()}`;
    setNodes((prev) => {
      const pos = defaultPositions[prev.length % defaultPositions.length];
      const sameTypeCount = prev.filter((node) => node.type === type).length + 1;

      return [
        ...prev,
        {
          id,
          label: getTopologyNodeLabel(type, sameTypeCount),
          type,
          x: pos.x,
          y: pos.y,
          status: "healthy",
        },
      ];
    });
  }, [newNodeType]);

  const updateNode = useCallback((idx: number, patch: Partial<TopologyNode>) => {
    setNodes((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  }, []);

  const updateNodeType = useCallback((idx: number, nextType: TopologyNode["type"]) => {
    setNodes((prev) =>
      prev.map((node, nodeIdx) => {
        if (nodeIdx !== idx) return node;

        return {
          ...node,
          type: nextType,
          label: renameDefaultTopologyNodeLabel(node.label, node.type, nextType),
        };
      }),
    );
  }, []);

  const removeNode = useCallback((idx: number) => {
    const removed = nodes[idx];
    setNodes((prev) => prev.filter((_, i) => i !== idx));
    setEdges((prev) => prev.filter((e) => e.from !== removed.id && e.to !== removed.id));
    setEvents((prev) =>
      prev.map((e) => ({ ...e, affectedNodes: e.affectedNodes.filter((n) => n !== removed.id) }))
    );
  }, [nodes]);

  const addEdge = useCallback(() => {
    if (nodes.length < 2) return;
    setEdges((prev) => [...prev, { from: nodes[0].id, to: nodes[1].id }]);
  }, [nodes]);

  const updateEdge = useCallback((idx: number, patch: Partial<TopologyEdge>) => {
    setEdges((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }, []);

  const removeEdge = useCallback((idx: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addEvent = useCallback(() => {
    setEvents((prev) => [
      ...prev,
      {
        id: `evt-${Date.now()}`,
        timestamp: prev.length > 0 ? (prev[prev.length - 1].timestamp + 15) : 0,
        type: "drift",
        severity: "medium",
        title: "",
        description: "",
        affectedNodes: [],
      },
    ]);
  }, []);

  const updateEvent = useCallback((idx: number, patch: Partial<TimelineEvent>) => {
    setEvents((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }, []);

  const removeEvent = useCallback((idx: number) => {
    setEvents((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const toggleEventNode = useCallback((eventIdx: number, nodeId: string) => {
    setEvents((prev) =>
      prev.map((e, i) => {
        if (i !== eventIdx) return e;
        const has = e.affectedNodes.includes(nodeId);
        return { ...e, affectedNodes: has ? e.affectedNodes.filter((n) => n !== nodeId) : [...e.affectedNodes, nodeId] };
      })
    );
  }, []);

  const handleSave = () => {
    const scenario: Scenario = {
      schemaVersion: SCENARIO_SCHEMA_VERSION,
      id: `custom-${Date.now()}`,
      name: name || "Custom Scenario",
      subtitle: subtitle || "User-created incident scenario",
      severity,
      duration,
      nodes,
      edges,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      narrative: {
        executiveSummary: `Custom scenario: ${name}. ${events.length} events across ${nodes.length} nodes.`,
        technicalSummary: `User-defined incident topology with ${edges.length} connections and ${events.filter((e) => e.type === "failure" || e.type === "cascade").length} failure points.`,
        rootCause: "Defined by scenario author.",
        actions: ["Review custom scenario results", "Adjust parameters as needed"],
        impactScore: severity === "critical" ? 90 : severity === "high" ? 70 : severity === "medium" ? 50 : 30,
      },
    };
    onSave(scenario);
  };

  const stepIdx = steps.findIndex((s) => s.key === step);
  const canNext = step === "meta" ? name.length > 0 : step === "nodes" ? nodes.length >= 2 : step === "edges" ? edges.length >= 1 : step === "events" ? events.length >= 1 : true;
  const nextNodeDefinition = getTopologyNodeDefinition(newNodeType);

  return (
    <div className="glass-panel p-5 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm uppercase tracking-widest text-foreground">Scenario Builder</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all ${
              s.key === step
                ? "bg-primary/20 text-primary border border-primary/30"
                : i <= stepIdx
                ? "text-foreground/70 hover:bg-secondary/50"
                : "text-muted-foreground/50"
            }`}
          >
            <span className="font-bold">{i + 1}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 space-y-3">
        {step === "meta" && (
          <>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Scenario Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DNS Cache Poisoning" className="bg-secondary/50 border-border/50 text-sm h-8" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Subtitle</label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Brief description of the incident" className="bg-secondary/50 border-border/50 text-sm h-8" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Severity</label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                  <SelectTrigger className="bg-secondary/50 border-border/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {severities.map((s) => <SelectItem key={s} value={s} className="text-xs">{s.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Duration (seconds)</label>
                <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="bg-secondary/50 border-border/50 text-sm h-8" min={30} max={600} />
              </div>
            </div>
          </>
        )}

        {step === "nodes" && (
          <>
            <div className="glass-panel-elevated p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{nodes.length} nodes</span>
                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => addNode()}>
                  <Plus className="h-3 w-3" /> Add {nextNodeDefinition.label}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">Node Type</label>
                  <Select value={newNodeType} onValueChange={(v) => setNewNodeType(v as TopologyNode["type"])}>
                    <SelectTrigger className="bg-secondary/50 border-border/50 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {topologyNodeTypeGroups.map((group) => (
                        <SelectGroup key={group.label}>
                          <SelectLabel className="pl-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </SelectLabel>
                          {group.types.map((type) => (
                            <SelectItem key={type} value={type} className="text-xs">
                              <span className="flex items-center gap-2">
                                <TopologyNodeIcon type={type} size={13} />
                                <span>{getTopologyNodeDefinition(type).label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="secondary" size="sm" className="h-8 text-xs gap-1.5" onClick={() => addNode()}>
                  <Plus className="h-3 w-3" /> Add Node
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">{nextNodeDefinition.description}</p>
              <div>
                <span className="font-mono text-[9px] text-muted-foreground uppercase mb-1.5 block">Quick Add</span>
                <div className="flex flex-wrap gap-1.5">
                  {featuredTopologyNodeTypes.map((type) => {
                    const definition = getTopologyNodeDefinition(type);

                    return (
                      <button
                        key={type}
                        type="button"
                        title={definition.description}
                        onClick={() => {
                          setNewNodeType(type);
                          addNode(type);
                        }}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono transition-all ${
                          newNodeType === type
                            ? "border-primary/40 bg-primary/15 text-foreground"
                            : "border-border/50 bg-secondary/40 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        <TopologyNodeIcon type={type} size={12} />
                        <span>{definition.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {nodes.map((node, i) => (
              <div key={node.id} className="glass-panel-elevated p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <TopologyNodeIcon type={node.type} size={14} />
                    <span className="flex flex-col">
                      <span>{node.label || "Unnamed"}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        {getTopologyNodeDefinition(node.type).label}
                      </span>
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-severity-critical" onClick={() => removeNode(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={node.label} onChange={(e) => updateNode(i, { label: e.target.value })} placeholder="Label" className="bg-secondary/50 border-border/50 text-xs h-7 flex-1" />
                  <Select value={node.type} onValueChange={(v) => updateNodeType(i, v as TopologyNode["type"])}>
                    <SelectTrigger className="bg-secondary/50 border-border/50 h-7 text-xs w-full sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-80">
                      {topologyNodeTypeGroups.map((group) => (
                        <SelectGroup key={group.label}>
                          <SelectLabel className="pl-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </SelectLabel>
                          {group.types.map((type) => (
                            <SelectItem key={type} value={type} className="text-xs">
                              <span className="flex items-center gap-2">
                                <TopologyNodeIcon type={type} size={13} />
                                <span>{getTopologyNodeDefinition(type).label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {getTopologyNodeDefinition(node.type).description}
                </p>
              </div>
            ))}
            {nodes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs font-mono">Add at least 2 nodes to define your topology</div>
            )}
          </>
        )}

        {step === "edges" && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{edges.length} connections</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addEdge} disabled={nodes.length < 2}>
                <Link2 className="h-3 w-3" /> Add Edge
              </Button>
            </div>
            {edges.map((edge, i) => (
              <div key={i} className="glass-panel-elevated p-3 flex items-center gap-2">
                <Select value={edge.from} onValueChange={(v) => updateEdge(i, { from: v })}>
                  <SelectTrigger className="bg-secondary/50 border-border/50 h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => <SelectItem key={n.id} value={n.id} className="text-xs">{n.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-xs">→</span>
                <Select value={edge.to} onValueChange={(v) => updateEdge(i, { to: v })}>
                  <SelectTrigger className="bg-secondary/50 border-border/50 h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => <SelectItem key={n.id} value={n.id} className="text-xs">{n.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-severity-critical" onClick={() => removeEdge(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {edges.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs font-mono">Add connections between your nodes</div>
            )}
          </>
        )}

        {step === "events" && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{events.length} events</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addEvent}>
                <Plus className="h-3 w-3" /> Add Event
              </Button>
            </div>
            {events.map((evt, i) => (
              <div key={evt.id} className="glass-panel-elevated p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2 flex-1">
                    <Input
                      type="number"
                      value={evt.timestamp}
                      onChange={(e) => updateEvent(i, { timestamp: Number(e.target.value) })}
                      className="bg-secondary/50 border-border/50 text-xs h-7 w-16"
                      min={0}
                      max={duration}
                      placeholder="t"
                    />
                    <Select value={evt.type} onValueChange={(v) => updateEvent(i, { type: v as TimelineEvent["type"] })}>
                      <SelectTrigger className="bg-secondary/50 border-border/50 h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((t) => <SelectItem key={t} value={t} className="text-xs">{t.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={evt.severity} onValueChange={(v) => updateEvent(i, { severity: v as Severity })}>
                      <SelectTrigger className="bg-secondary/50 border-border/50 h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {severities.map((s) => <SelectItem key={s} value={s} className="text-xs">{s.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-severity-critical" onClick={() => removeEvent(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input value={evt.title} onChange={(e) => updateEvent(i, { title: e.target.value })} placeholder="Event title" className="bg-secondary/50 border-border/50 text-xs h-7" />
                <Textarea value={evt.description} onChange={(e) => updateEvent(i, { description: e.target.value })} placeholder="Description" className="bg-secondary/50 border-border/50 text-xs min-h-[50px] resize-none" />
                <div>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase mb-1 block">Affected Nodes</span>
                  <div className="flex flex-wrap gap-1">
                    {nodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => toggleEventNode(i, n.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                          evt.affectedNodes.includes(n.id)
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"
                        }`}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs font-mono">Add timeline events for your incident</div>
            )}
          </>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="glass-panel-elevated p-4">
              <h4 className="font-heading text-xs text-foreground mb-2">{name || "Unnamed Scenario"}</h4>
              <p className="text-[10px] text-muted-foreground mb-3">{subtitle}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-mono text-lg text-foreground">{nodes.length}</div>
                  <div className="font-mono text-[9px] text-muted-foreground uppercase">Nodes</div>
                </div>
                <div>
                  <div className="font-mono text-lg text-foreground">{edges.length}</div>
                  <div className="font-mono text-[9px] text-muted-foreground uppercase">Edges</div>
                </div>
                <div>
                  <div className="font-mono text-lg text-foreground">{events.length}</div>
                  <div className="font-mono text-[9px] text-muted-foreground uppercase">Events</div>
                </div>
              </div>
            </div>
            {/* Mini topology preview */}
            <div className="glass-panel-elevated p-3">
              <span className="font-mono text-[9px] text-muted-foreground uppercase mb-2 block">Topology Preview</span>
              <svg viewBox="0 0 800 400" className="w-full h-32">
                {edges.map((edge, i) => {
                  const from = nodes.find((n) => n.id === edge.from);
                  const to = nodes.find((n) => n.id === edge.to);
                  if (!from || !to) return null;
                  return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="stroke-topology-line/50" strokeWidth={1} />;
                })}
                {nodes.map((n) => (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r={16} className="fill-severity-low/20 stroke-severity-low" strokeWidth={1.5} />
                    <g transform={`translate(${n.x - 6} ${n.y - 6})`} pointerEvents="none">
                      <TopologyNodeIcon type={n.type} size={12} strokeWidth={2} />
                    </g>
                  </g>
                ))}
              </svg>
            </div>
            {/* Event timeline preview */}
            <div className="glass-panel-elevated p-3">
              <span className="font-mono text-[9px] text-muted-foreground uppercase mb-2 block">Event Timeline</span>
              <div className="relative h-3 bg-secondary/50 rounded-full">
                {events.map((evt, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 h-3 w-1 rounded-full ${
                      evt.severity === "critical" ? "bg-severity-critical" :
                      evt.severity === "high" ? "bg-severity-high" :
                      evt.severity === "medium" ? "bg-severity-medium" :
                      "bg-severity-low"
                    }`}
                    style={{ left: `${(evt.timestamp / duration) * 100}%` }}
                    title={evt.title}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setStep(steps[Math.max(0, stepIdx - 1)].key)}
          disabled={stepIdx === 0}
        >
          Back
        </Button>
        {step === "review" ? (
          <Button size="sm" className="text-xs gap-1.5" onClick={handleSave} disabled={nodes.length < 2 || events.length < 1}>
            <Save className="h-3 w-3" /> Save & Run
          </Button>
        ) : (
          <Button
            size="sm"
            className="text-xs"
            onClick={() => setStep(steps[Math.min(steps.length - 1, stepIdx + 1)].key)}
            disabled={!canNext}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
};
