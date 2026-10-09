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
  onDpadPress?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelectPress: () => void;
  onBackPress?: () => void;
  onHomePress?: () => void;
  onVoicePress?: () => void;
  onMutePress: () => void;
  onPowerPress: () => void;
  onVolumeChange: (delta: number) => void;
  onCloseApp?: () => void;
  isListening?: boolean;
  isTVOn?: boolean;
  connectedDevice?: SmartTVDevice | null;
}

export function MiniRemote({
  isOpen,
  onExpand,
  onSelectPress,
  onMutePress,
  onPowerPress,
  onVolumeChange,
  onCloseApp,
  connectedDevice,
}: MiniRemoteProps) {
  if (!isOpen) return null;

  // Safe screen boundary helpers (Pebble width is 154px, height is ~140px)
  const PEBBLE_WIDTH = 154;
  const PEBBLE_HEIGHT = 145;
  const MARGIN_X = 12;
  const MARGIN_Y = 16;

  const clampX = useCallback((x: number) => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 360;
    const maxX = Math.max(MARGIN_X, width - PEBBLE_WIDTH - MARGIN_X);
    return Math.min(Math.max(MARGIN_X, x), maxX);
  }, []);

  const clampY = useCallback((y: number) => {
    const height = typeof window !== 'undefined' ? window.innerHeight : 640;
    const maxY = Math.max(MARGIN_Y, height - PEBBLE_HEIGHT - MARGIN_Y);
    return Math.min(Math.max(MARGIN_Y, y), maxY);
  }, []);

  // Floating drag position: safely clamped inside phone viewport at all times
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 360;
    const height = typeof window !== 'undefined' ? window.innerHeight : 640;
    const defaultX = Math.max(MARGIN_X, width - PEBBLE_WIDTH - 16);
    const defaultY = Math.max(MARGIN_Y, height - PEBBLE_HEIGHT - 90);

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('gtv_mini_remote_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const maxX = Math.max(MARGIN_X, width - PEBBLE_WIDTH - MARGIN_X);
            const maxY = Math.max(MARGIN_Y, height - PEBBLE_HEIGHT - MARGIN_Y);
            return {
              x: Math.min(Math.max(MARGIN_X, parsed.x), maxX),
              y: Math.min(Math.max(MARGIN_Y, parsed.y), maxY),
            };
          }
        }
      } catch {}
    }
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
    const nextX = clampX(dragRef.current.initialX + deltaX);
    const nextY = clampY(dragRef.current.initialY + deltaY);
    setPosition({ x: nextX, y: nextY });
  }, [clampX, clampY]);

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

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, moveDrag, endDrag]);

  // Keep strictly inside screen bounds on resize/orientation change
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: clampX(prev.x),
        y: clampY(prev.y),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampX, clampY]);

  // Touch drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }
    const { clientX, clientY, pointerId } = e;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(pointerId);
    } catch {}
    startDrag(clientX, clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      endDrag();
    }
  };

  // Double-click/tap on blank area to center remote on screen
  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const width = typeof window !== 'undefined' ? window.innerWidth : 360;
    const height = typeof window !== 'undefined' ? window.innerHeight : 640;
    const centerX = clampX(Math.round((width - PEBBLE_WIDTH) / 2));
    const centerY = clampY(Math.round((height - PEBBLE_HEIGHT) / 2));
    sound.playClick('soft');
    setPosition({ x: centerX, y: centerY });
    try {
      localStorage.setItem('gtv_mini_remote_pos', JSON.stringify({ x: centerX, y: centerY }));
    } catch {}
  };

  // Sleek Minimal Remote Pebble (Exact original size: 154px, 3 rows only)
  const pebbleContent = (
    <div
      onDoubleClick={handleDoubleClick}
      title="Drag anywhere on blank area to move. Double-tap to center."
      className={`w-[154px] max-w-[92vw] rounded-[26px] border-2 bg-[#EDEDF0] text-slate-800 p-2.5 pt-2 select-none remote-shadow flex flex-col items-center shrink-0 my-auto transition-all ${
        isDragging ? 'ring-2 ring-sky-400/70 shadow-2xl border-sky-300 scale-[1.02]' : 'border-[#D9DDE2]'
      }`}
    >
      {/* 1. Top Controls (TV status, Power, Expand to full, Close) */}
      <div className="w-full flex items-center justify-between pb-1.5 mb-2 border-b border-black/10 select-none">
        <div className="flex items-center gap-1.5 pl-0.5 py-0.5 min-w-0 max-w-[70px] pointer-events-none">
          {connectedDevice?.isConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
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
            title="Close Remote & Exit"
            className="w-7 h-7 rounded-xl bg-[#E1E5EA] hover:bg-rose-100 border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-rose-600 transition-colors active:scale-95 cursor-pointer touch-manipulation shadow-sm"
          >
            <X className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* 2. Main Play / Pause (OK Button) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sound.playClick('action');
          onSelectPress();
        }}
        title="Play / Pause (OK / Select)"
        className="w-full h-11 mb-2 rounded-2xl bg-gradient-to-b from-[#FAFBFD] to-[#E2E6EC] hover:from-[#F0F3F7] hover:to-[#D9DFE6] active:from-slate-200 active:to-slate-300 border border-[#CBD1DB] shadow-[0_2px_5px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.85)] flex items-center justify-center gap-1.5 cursor-pointer text-slate-700 font-semibold text-xs tracking-wider transition-all active:scale-95 touch-manipulation focus:outline-none ring-1 ring-black/5"
      >
        <Play className="w-3 h-3 fill-slate-700 text-slate-700 ml-0.5" />
        <span>OK</span>
        <Pause className="w-3 h-3 fill-slate-700 text-slate-700" />
      </button>

      {/* 3. Volume Controls & Mute Row */}
      <div className="grid grid-cols-3 gap-1.5 w-full">
        {/* Volume Down */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onVolumeChange(-5);
          }}
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
          title="Volume Up (+)"
          className="h-9 rounded-xl bg-[#E4E8EE] hover:bg-[#D9DEE5] active:bg-slate-200 border border-[#CBD1DB] shadow-sm flex items-center justify-center active:scale-95 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer touch-manipulation focus:outline-none"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none bg-transparent">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
