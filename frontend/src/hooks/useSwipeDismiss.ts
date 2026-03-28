import { useCallback, useRef } from 'react';

export interface SwipeDismissHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface SwipeDismissOptions {
  enabled: boolean;
  onDismiss: () => void;
  canStart?: () => boolean;
  thresholdPx?: number;
  maxDurationMs?: number;
}

/**
 * Enables swipe-to-dismiss handling on touch devices.
 */
export function useSwipeDismiss({
  enabled,
  onDismiss,
  canStart,
  thresholdPx = 80,
  maxDurationMs = 700,
}: SwipeDismissOptions): SwipeDismissHandlers {
  const startRef = useRef<{ y: number; time: number } | null>(null);
  const lastYRef = useRef(0);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      if (canStart && !canStart()) return;
      if (event.touches.length === 0) return;
      const touch = event.touches[0];
      startRef.current = { y: touch.clientY, time: Date.now() };
      lastYRef.current = touch.clientY;
    },
    [enabled, canStart],
  );

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    if (!startRef.current) return;
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    lastYRef.current = touch.clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!startRef.current) return;
    const { y, time } = startRef.current;
    const delta = lastYRef.current - y;
    const duration = Date.now() - time;
    startRef.current = null;

    if (delta < -thresholdPx && duration <= maxDurationMs) {
      onDismiss();
    }
  }, [maxDurationMs, onDismiss, thresholdPx]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
