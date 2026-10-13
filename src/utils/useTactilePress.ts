import { useRef, useEffect, useCallback } from 'react';

export interface TactileOptions {
  repeatable?: boolean;
  repeatDelay?: number;
  repeatInterval?: number;
}

/**
 * Custom hook to provide instant, zero-latency tactile button press responsiveness.
 *
 * Eliminates mobile 300ms click delay and touch cancellation from micro-movements,
 * ensuring buttons fire immediately upon touch down (0ms) rather than waiting for touch up.
 * Supports auto-repeat when held (for volume and navigation keys) and prevents duplicate
 * synthetic click execution.
 */
export function useTactilePress() {
  const activeTimersRef = useRef<Map<string, { timer: number; interval?: number }>>(new Map());
  const lastTriggeredRef = useRef<Map<string, number>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = activeTimersRef.current.get(id);
    if (t) {
      window.clearTimeout(t.timer);
      if (t.interval) window.clearInterval(t.interval);
      activeTimersRef.current.delete(id);
    }
  }, []);

  const bind = useCallback(
    (
      id: string,
      action: () => void,
      options?: TactileOptions
    ) => {
      const repeatable = options?.repeatable ?? false;
      const repeatDelay = options?.repeatDelay ?? 320;
      const repeatInterval = options?.repeatInterval ?? 110;

      const fire = () => {
        lastTriggeredRef.current.set(id, Date.now());
        action();
      };

      return {
        onPointerDown: (e: React.PointerEvent) => {
          e.stopPropagation();
          if (e.pointerType === 'touch') {
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {}
          }
          fire();

          if (repeatable) {
            clearTimer(id);
            const timer = window.setTimeout(() => {
              const interval = window.setInterval(() => {
                fire();
              }, repeatInterval);
              activeTimersRef.current.set(id, { timer, interval });
            }, repeatDelay);
            activeTimersRef.current.set(id, { timer });
          }
        },
        onPointerUp: (e: React.PointerEvent) => {
          e.stopPropagation();
          clearTimer(id);
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {}
        },
        onPointerCancel: (e: React.PointerEvent) => {
          e.stopPropagation();
          clearTimer(id);
        },
        onPointerLeave: () => {
          clearTimer(id);
        },
        onTouchStart: (e: React.TouchEvent) => {
          // Explicitly stop touch propagation so parent draggable containers never intercept
          e.stopPropagation();
        },
        onTouchMove: (e: React.TouchEvent) => {
          e.stopPropagation();
        },
        onTouchEnd: (e: React.TouchEvent) => {
          e.stopPropagation();
          clearTimer(id);
        },
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          // Fallback for keyboard navigation or non-pointer click events
          const last = lastTriggeredRef.current.get(id) || 0;
          if (Date.now() - last > 350) {
            fire();
          }
        },
      };
    },
    [clearTimer]
  );

  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach((t) => {
        window.clearTimeout(t.timer);
        if (t.interval) window.clearInterval(t.interval);
      });
      activeTimersRef.current.clear();
    };
  }, []);

  return bind;
}
