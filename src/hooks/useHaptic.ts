import { useCallback } from "react";

/**
 * Haptic feedback hook for mobile devices
 * Provides lightweight tactile feedback for user interactions
 * Only works on devices that support the Vibration API
 */

type HapticPattern = 
  | "light"      // Short, light tap (selection, button press)
  | "medium"     // Medium tap (confirmation, toggle)
  | "heavy"      // Heavy tap (error, warning, important action)
  | "success"    // Double tap pattern (success completion)
  | "error";     // Triple short taps (error)

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 50, 10],
  error: [15, 30, 15, 30, 15],
};

export function useHaptic() {
  const vibrate = useCallback((pattern: HapticPattern) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(patterns[pattern]);
      } catch {
        // Silently fail if vibration API throws
      }
    }
  }, []);

  const light = useCallback(() => vibrate("light"), [vibrate]);
  const medium = useCallback(() => vibrate("medium"), [vibrate]);
  const heavy = useCallback(() => vibrate("heavy"), [vibrate]);
  const success = useCallback(() => vibrate("success"), [vibrate]);
  const errorHaptic = useCallback(() => vibrate("error"), [vibrate]);

  return { vibrate, light, medium, heavy, success, error: errorHaptic };
}