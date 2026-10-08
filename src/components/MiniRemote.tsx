import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Maximize2,
  VolumeX,
  Power,
  Play,
  Pause,
  X,
} from 'lucide-react';
import { sound } from '../utils/audio';
import { RemoteTheme } from '../types/remote';
import { SmartTVDevice } from '../utils/universalTVProtocol';

interface MiniRemoteProps {
  isOpen: boolean;
  theme: RemoteTheme;
  isPip?: boolean;
  onExpand: () => void;
  onDpadPress: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelectPress: () => void;
  onBackPress: () => void;
  onHomePress: () => void;
  onVoicePress?: () => void;
  onMutePress: () => void;
  onPowerPress: () => void;
  onVolumeChange: (delta: number) => void;
  onCloseApp?: () => void;
  isListening?: boolean;
  isTVOn: boolean;
  connectedDevice?: SmartTVDevice | null;
}

export function MiniRemote({
  isOpen,
  onExpand,
  onDpadPress,
  onSelectPress,
  onBackPress,
  onHomePress,
  onVoicePress,
  onMutePress,
  onPowerPress,
  onVolumeChange,
  onCloseApp,
  isListening,
  connectedDevice,
}: MiniRemoteProps) {
  if (!isOpen) return null;

  // Floating drag position (persisted in localStorage)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 100 };
    const saved = localStorage.getItem('gtv_mini_remote_pos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(10, window.innerWidth - 170);
          const maxY = Math.max(10, window.innerHeight - 320);
          return {
            x: Math.min(Math.max(8, parsed.x), maxX),
            y: Math.min(Math.max(8, parsed.y), maxY),
          };
        }
      } catch {
        // fallback
      }
    }
    // Default to right-side floating position
    const defaultX = Math.max(12, (window.innerWidth || 360) - 176);
    const defaultY = Math.max(60, (window.innerHeight || 640) - 340);
    return { x: defaultX, y: defaultY };
  });

  const positionRef = useRef(position);
  positionRef.current = position;

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    };
  }, []);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;

    const minX = -60;
    const maxX = Math.max(30, (window.innerWidth || 360) - 60);
    const minY = 6;
    const maxY = Math.max(30, (window.innerHeight || 640) - 60);

    const nextX = Math.min(Math.max(minX, dragRef.current.initialX + deltaX), maxX);
    const nextY = Math.min(Math.max(minY, dragRef.current.initialY + deltaY), maxY);

    setPosition({ x: nextX, y: nextY });
  }, []);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    setIsDragging(false);
    dragRef.current = null;
    try {
      localStorage.setItem('gtv_mini_remote_pos', JSON.stringify(positionRef.current));
    } catch {}
  }, []);

  // Global listeners during dragging
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    };

    const onPointerUp = () => {
      endDrag();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEnd = () => {
      endDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging, moveDrag, endDrag]);

  // Keep inside screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(30, (window.innerWidth || 360) - 60);
        const maxY = Math.max(30, (window.innerHeight || 640) - 60);
        return {
          x: Math.min(Math.max(-60, prev.x), maxX),
          y: Math.min(Math.max(6, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Long-press timer on empty area to initiate dragging
  const longPressTimerRef = useRef<number | null>(null);
  const pendingTouchRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingTouchRef.current = null;
  }, []);

  // Pointer drag handlers with pointer capture on empty area
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }
    const { clientX, clientY, pointerId } = e;
    pendingTouchRef.current = { clientX, clientY };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(pointerId);
    } catch {}

    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      sound.playClick('soft');
      startDrag(clientX, clientY);
    }, 140);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
      return;
    }

    if (pendingTouchRef.current) {
      const dist = Math.hypot(e.clientX - pendingTouchRef.current.clientX, e.clientY - pendingTouchRef.current.clientY);
      if (dist > 7) {
        cancelLongPress();
        sound.playClick('soft');
        startDrag(e.clientX, e.clientY);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    cancelLongPress();
    if (isDragging) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      endDrag();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }
    const t = e.touches[0];
    if (!t) return;

    const { clientX, clientY } = t;
    pendingTouchRef.current = { clientX, clientY };

    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      sound.playClick('soft');
      startDrag(clientX, clientY);
    }, 140);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;

    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      moveDrag(t.clientX, t.clientY);
      return;
    }

    if (pendingTouchRef.current) {
      const dist = Math.hypot(t.clientX - pendingTouchRef.current.clientX, t.clientY - pendingTouchRef.current.clientY);
      if (dist > 7) {
        e.preventDefault();
        cancelLongPress();
        sound.playClick('soft');
        startDrag(t.clientX, t.clientY);
      }
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (isDragging) {
      endDrag();
    }
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick('soft');
    const defaultX = Math.max(12, (window.innerWidth || 360) - 176);
    const defaultY = Math.max(60, (window.innerHeight || 640) - 340);
    setPosition({ x: defaultX, y: defaultY });
    try {
      localStorage.setItem('gtv_mini_remote_pos', JSON.stringify({ x: defaultX, y: defaultY }));
    } catch {}
  };

  // Remote pebble content (Sleek Minimal: Header, Play/Pause OK, Volume & Mute)
  const pebbleContent = (
    <div
      title="Long-press any empty area to move mini remote. Double-tap to reset."
      className={`w-[154px] max-w-[94vw] rounded-[26px] border-2 bg-[#EDEDF0] text-slate-800 p-2.5 pt-2 select-none remote-shadow flex flex-col items-center shrink-0 my-auto transition-all ${
        isDragging ? 'ring-2 ring-sky-400/70 shadow-2xl border-sky-300 scale-[1.02]' : 'border-[#D9DDE2]'
      }`}
    >
      {/* Top Controls (Power & Expand) */}
      <div
        className="w-full flex items-center justify-between pb-1.5 mb-2 border-b border-black/10 select-none"
      >
        <div className="flex items-center gap-1.5 pl-0.5 py-0.5 min-w-0 max-w-[70px] pointer-events-none">
          {connectedDevice?.isConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          )}
          <span className="text-[10px] font-semibold text-slate-700 truncate">
            {connectedDevice ? connectedDevice.name : 'TV'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Power Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('action');
              onPowerPress();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="TV Power"
            className="w-7 h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-emerald-600 transition-colors active:scale-95 cursor-pointer touch-manipulation shadow-sm"
          >
            <Power className="w-3.5 h-3.5 stroke-[2]" />
          </button>

          {/* Expand to Full Remote Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('action');
              onExpand();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Expand to Full Remote"
            className="w-7 h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer touch-manipulation shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5 stroke-[2]" />
          </button>

          {/* Close Remote Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('soft');
              onCloseApp?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Close Remote & Exit"
            className="w-7 h-7 rounded-xl bg-[#E1E5EA] hover:bg-rose-100 border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-rose-600 transition-colors active:scale-95 cursor-pointer touch-manipulation shadow-sm"
          >
            <X className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Main Play / Pause (OK Button) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sound.playClick('action');
          onSelectPress();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title="Play / Pause (OK / Select)"
        className="w-full h-11 mb-2 rounded-2xl bg-gradient-to-b from-[#FAFBFD] to-[#E2E6EC] hover:from-[#F0F3F7] hover:to-[#D9DFE6] active:from-slate-200 active:to-slate-300 border border-[#CBD1DB] shadow-[0_2px_5px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.85)] flex items-center justify-center gap-1.5 cursor-pointer text-slate-700 font-semibold text-xs tracking-wider transition-all active:scale-95 touch-manipulation focus:outline-none ring-1 ring-black/5"
      >
        <Play className="w-3 h-3 fill-slate-700 text-slate-700 ml-0.5" />
        <span>OK</span>
        <Pause className="w-3 h-3 fill-slate-700 text-slate-700" />
      </button>

      {/* Volume Controls & Mute Row */}
      <div className="grid grid-cols-3 gap-1.5 w-full">
        {/* Volume Down */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onVolumeChange(-5);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Volume Down (−)"
          className="h-9 rounded-xl bg-[#E4E8EE] hover:bg-[#D9DEE5] active:bg-slate-200 border border-[#CBD1DB] shadow-sm flex items-center justify-center active:scale-95 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer touch-manipulation focus:outline-none"
        >
          −
        </button>

        {/* Mute */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('button');
            onMutePress();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Mute Audio"
          className="h-9 rounded-xl bg-[#E4E8EE] hover:bg-[#D9DEE5] active:bg-slate-200 border border-[#CBD1DB] shadow-sm flex items-center justify-center active:scale-95 text-slate-700 hover:text-slate-900 cursor-pointer touch-manipulation focus:outline-none"
        >
          <VolumeX className="w-4 h-4 stroke-[2]" />
        </button>

        {/* Volume Up */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onVolumeChange(5);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Volume Up (+)"
          className="h-9 rounded-xl bg-[#E4E8EE] hover:bg-[#D9DEE5] active:bg-slate-200 border border-[#CBD1DB] shadow-sm flex items-center justify-center active:scale-95 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer touch-manipulation focus:outline-none"
        >
          +
        </button>
      </div>
    </div>
  );

  // In-app floating mode: freely draggable anywhere across the screen with interactive buttons
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none bg-transparent">
      <div
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          willChange: 'transform',
        }}
        className={`pointer-events-auto touch-none cursor-grab ${
          isDragging ? 'cursor-grabbing shadow-2xl scale-[1.02]' : ''
        } transition-shadow duration-150 inline-block remote-draggable-container`}
      >
        {pebbleContent}
      </div>
    </div>
  );
}
