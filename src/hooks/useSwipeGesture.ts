import { useCallback, useRef, useState } from "react";

export type SwipeDirection = "left" | "right" | "up";

interface SwipeGestureOptions {
  disabled?: boolean;
  threshold?: number;
  verticalThreshold?: number;
  tapDistance?: number;
  onSwipe: (direction: SwipeDirection) => void;
  onTap?: () => void;
}

export function useSwipeGesture({
  disabled = false,
  threshold = 96,
  verticalThreshold = 80,
  tapDistance = 8,
  onSwipe,
  onTap,
}: SwipeGestureOptions) {
  const start = useRef<{ x: number; y: number; pointerId: number | null } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    start.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled || !start.current) return;
      setOffset({
        x: Math.max(-180, Math.min(180, event.clientX - start.current.x)),
        y: Math.max(-140, Math.min(80, event.clientY - start.current.y)),
      });
    },
    [disabled],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled || !start.current) {
        reset();
        return;
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const x = event.clientX - start.current.x;
      const y = event.clientY - start.current.y;
      const absX = Math.abs(x);
      const absY = Math.abs(y);
      reset();

      if (absX <= tapDistance && absY <= tapDistance) {
        onTap?.();
        return;
      }
      if (y < -verticalThreshold && absY > absX * 0.8) {
        onSwipe("up");
        return;
      }
      if (x > threshold) onSwipe("right");
      if (x < -threshold) onSwipe("left");
    },
    [disabled, onSwipe, onTap, reset, tapDistance, threshold, verticalThreshold],
  );

  return {
    offset,
    dragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onLostPointerCapture: reset,
    },
  };
}
