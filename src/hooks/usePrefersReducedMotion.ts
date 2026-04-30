import React from "react";
import {
  resolvePrefersReducedMotion,
  type MotionMode,
} from "@/lib/motionPreferences";

const MotionPreferenceContext = React.createContext<MotionMode>("system");

function readSystemReducedMotionPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MotionPreferenceProvider({
  mode,
  children,
}: {
  mode: MotionMode;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    root.dataset.motionMode = mode;

    return () => {
      if (root.dataset.motionMode === mode) {
        root.removeAttribute("data-motion-mode");
      }
    };
  }, [mode]);

  return React.createElement(MotionPreferenceContext.Provider, { value: mode }, children);
}

export function useMotionMode() {
  return React.useContext(MotionPreferenceContext);
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(() => {
    return readSystemReducedMotionPreference();
  });
  const motionMode = useMotionMode();

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return resolvePrefersReducedMotion(motionMode, prefersReducedMotion);
}
