import {
  getTopologyNodeDefinition,
  type TopologyNodeType,
} from "@/lib/topologyNodes";
import { cn } from "@/lib/utils";

interface TopologyNodeIconProps {
  type: TopologyNodeType;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function TopologyNodeIcon({
  type,
  size = 16,
  strokeWidth = 1.8,
  className,
}: TopologyNodeIconProps) {
  const { icon: Icon, className: toneClassName } = getTopologyNodeDefinition(type);

  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", toneClassName, className)}
    />
  );
}
