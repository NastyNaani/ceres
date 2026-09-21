import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

/** True when the OS Reduce Motion setting is enabled. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/** Shared timing for snappy UI motion. */
export const motion = {
  instant: 0,
  fast: 140,
  snappy: 160,
  normal: 220,
} as const;
