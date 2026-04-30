export const motionModeValues = ["system", "reduced", "full"] as const;

export type MotionMode = (typeof motionModeValues)[number];

export const motionModeLabels: Record<MotionMode, string> = {
  system: "System default",
  reduced: "Reduced motion",
  full: "Full motion",
};

export const motionModeDescriptions: Record<MotionMode, string> = {
  system: "Follow the operating system or browser motion preference.",
  reduced: "Minimize animation and moving effects throughout the simulator.",
  full: "Allow the complete animation system even when the OS prefers reduced motion.",
};

export function resolvePrefersReducedMotion(
  mode: MotionMode,
  systemPrefersReducedMotion: boolean,
) {
  if (mode === "reduced") {
    return true;
  }

  if (mode === "full") {
    return false;
  }

  return systemPrefersReducedMotion;
}
