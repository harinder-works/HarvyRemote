import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Maximize2,
  GripHorizontal,
  Move,
  ArrowLeft,
  Home,
  VolumeX,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Power,
  X,
} from 'lucide-react';
import { GoogleDots, GoogleAssistantLines } from './BrandIcons';
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
  onVoicePress: () => void;
  onMutePress: () => void;
  onPowerPress: () => void;
  onVolumeChange: (delta: number) => void;
  onCloseApp?: () => void;
  isListening: boolean;
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

  // Remote pebble content
  const pebbleContent = (
    <div
      title="Long-press any empty area to move mini remote. Double-tap to reset."
      className={`w-[158px] max-w-[96vw] rounded-[32px] border-2 bg-[#EDEDF0] text-slate-800 p-2 pt-2 select-none remote-shadow flex flex-col items-center shrink-0 my-auto transition-all ${
        isDragging ? 'ring-2 ring-sky-400/70 shadow-2xl border-sky-300 scale-[1.02]' : 'border-[#D9DDE2]'
      }`}
    >
      {/* Top Controls (Power & Expand) */}
      <div
        className="w-full flex items-center justify-between pb-1 mb-1 border-b border-black/10 select-none"
      >
        <div className="flex items-center gap-1 pl-1 py-0.5 min-w-0 max-w-[85px] pointer-events-none">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
            {connectedDevice ? connectedDevice.name : 'Google TV'}
          </span>
          {connectedDevice?.isConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Power Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('action');
              onPowerPress();
            }}
            title="TV Power"
            className="p-1 rounded-full hover:bg-black/10 text-emerald-600 transition-colors active:scale-90 cursor-pointer"
          >
            <Power className="w-3 h-3" />
          </button>

          {/* Expand to Full Remote Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('action');
              onExpand();
            }}
            title="Expand to Full Remote"
            className="p-1 rounded-full hover:bg-black/10 text-sky-600 transition-colors active:scale-90 cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
          </button>

          {/* Close Remote Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('soft');
              onCloseApp?.();
            }}
            title="Close Remote & Exit"
            className="p-1 rounded-full hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors active:scale-90 cursor-pointer"
          >
            <X className="w-3 h-3 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* Mini D-Pad */}
      <div className="relative w-[104px] h-[104px] mx-auto my-0.5 flex items-center justify-center">
        {/* Directional Pad Ring */}
        <div className="absolute inset-0 rounded-full bg-[#DFE3E8] border border-[#CFD4DC] dpad-groove">
          {/* Up */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('up');
            }}
            title="Up"
            className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center pt-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          {/* Down */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('down');
            }}
            title="Down"
            className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center pb-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {/* Left */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('left');
            }}
            title="Left"
            className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center pl-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {/* Right */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('right');
            }}
            title="Right"
            className="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-center pr-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center OK */}
        <button
          type="button"
          onClick={() => {
            sound.playClick('action');
            onSelectPress();
          }}
          title="Select / OK"
          className="relative z-10 w-9 h-9 rounded-full bg-[#EAEEF3] border border-[#D5DAE2] remote-button-shadow active:scale-90 transition-transform flex items-center justify-center text-[10px] font-bold text-slate-700 cursor-pointer"
        >
          OK
        </button>
      </div>

      {/* Row 1: Back, Voice Assistant, Home */}
      <div className="grid grid-cols-3 gap-1 w-full my-0.5">
        <button
          type="button"
          onClick={() => {
            sound.playClick('button');
            onBackPress();
          }}
          title="Back"
          className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all text-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onVoicePress}
          title="Google Assistant Voice Search (Listen)"
          className={`h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
            isListening ? 'ring-2 ring-sky-400 bg-sky-100' : ''
          }`}
        >
          <GoogleAssistantLines size="sm" active={isListening} />
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick('button');
            onHomePress();
          }}
          title="Home"
          className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all text-slate-700 cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row 2: Volume Controls & Mute */}
      <div className="grid grid-cols-3 gap-1 w-full my-0.5">
        <button
          type="button"
          onClick={() => {
            sound.playClick('dpad');
            onVolumeChange(-5);
          }}
          title="Volume Down"
          className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-xs font-bold text-slate-700 cursor-pointer"
        >
          −
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick('button');
            onMutePress();
          }}
          title="Mute"
          className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-slate-700 cursor-pointer"
        >
          <VolumeX className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick('dpad');
            onVolumeChange(5);
          }}
          title="Volume Up"
          className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-xs font-bold text-slate-700 cursor-pointer"
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
