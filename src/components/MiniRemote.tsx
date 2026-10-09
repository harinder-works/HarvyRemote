import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Maximize2,
  VolumeX,
  Power,
  Play,
  Pause,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Undo2,
  Tv,
  Usb,
} from 'lucide-react';
import { sound } from '../utils/audio';
import { RemoteTheme } from '../types/remote';
import { SmartTVDevice, universalTV } from '../utils/universalTVProtocol';

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
  onInputPress?: () => void;
  onUsbPress?: () => void;
  onLaunchApp?: (appId: string) => void;
  onVolumeChange: (delta: number) => void;
  onCloseApp?: () => void;
  isListening?: boolean;
  isTVOn?: boolean;
  connectedDevice?: SmartTVDevice | null;
}

export function MiniRemote({
  isOpen,
  onExpand,
  onDpadPress,
  onSelectPress,
  onBackPress,
  onHomePress,
  onMutePress,
  onPowerPress,
  onInputPress,
  onUsbPress,
  onLaunchApp,
  onVolumeChange,
  onCloseApp,
  connectedDevice,
}: MiniRemoteProps) {
  if (!isOpen) return null;

  const [windowDimensions, setWindowDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 360,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Floating drag position for desktop / browser testing
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 100 };
    const saved = localStorage.getItem('gtv_mini_remote_pos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(10, window.innerWidth - 220);
          const maxY = Math.max(10, window.innerHeight - 440);
          return {
            x: Math.min(Math.max(8, parsed.x), maxX),
            y: Math.min(Math.max(8, parsed.y), maxY),
          };
        }
      } catch {}
    }
    const defaultX = Math.max(12, (window.innerWidth || 360) - 232);
    const defaultY = Math.max(40, (window.innerHeight || 640) - 460);
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

    const minX = 0;
    const maxX = Math.max(20, (window.innerWidth || 360) - 220);
    const minY = 0;
    const maxY = Math.max(20, (window.innerHeight || 640) - 440);

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

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, moveDrag, endDrag]);

  // Keep inside screen bounds on resize
  useEffect(() => {
    const maxX = Math.max(20, windowDimensions.width - 220);
    const maxY = Math.max(20, windowDimensions.height - 440);
    setPosition((prev) => ({
      x: Math.min(Math.max(8, prev.x), maxX),
      y: Math.min(Math.max(8, prev.y), maxY),
    }));
  }, [windowDimensions]);

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

  const launchShortcut = (appId: string) => {
    sound.playClick('action');
    if (onLaunchApp) {
      onLaunchApp(appId);
    } else {
      universalTV.launchApp(appId);
    }
  };

  // Complete, fully-functional mini remote pebble
  const pebbleContent = (
    <div
      className={`w-[216px] max-w-[94vw] flex flex-col justify-between rounded-[32px] border-2 bg-[#EAEDF1] border-[#D3D8DF] text-slate-800 p-2.5 shadow-2xl select-none transition-all ${
        isDragging ? 'ring-2 ring-sky-400 shadow-2xl scale-[1.02]' : ''
      }`}
    >
      {/* 1. Header Row (TV status, Expand, Close) */}
      <div className="w-full flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/10 select-none">
        <div className="flex items-center gap-1.5 min-w-0 max-w-[90px] pointer-events-none">
          <span className={`w-2 h-2 rounded-full shrink-0 ${connectedDevice?.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-[10px] font-bold text-slate-700 truncate leading-tight">
            {connectedDevice ? connectedDevice.name : 'TV Remote'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Expand to Full Remote Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('action');
              onExpand();
            }}
            title="Expand to Full Remote"
            className="px-2 py-1 rounded-lg bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center gap-1 text-[9.5px] font-bold text-slate-700 hover:text-slate-900 active:scale-95 cursor-pointer shadow-sm"
          >
            <Maximize2 className="w-3 h-3 stroke-[2.2]" />
            <span>Full</span>
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
            className="w-7 h-7 rounded-lg bg-[#DEE2E8] hover:bg-rose-100 hover:text-rose-600 border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
          >
            <X className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* 2. Top Hardware Row: Power, Input, USB, Mute */}
      <div className="grid grid-cols-4 gap-1 w-full mb-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('action');
            onPowerPress();
          }}
          title="TV Power"
          className="h-8 rounded-xl bg-[#DEE2E8] hover:bg-emerald-50 hover:text-emerald-600 border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <Power className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('action');
            if (onInputPress) onInputPress();
            else universalTV.sendAction('TV_INPUT');
          }}
          title="TV Input / Source"
          className="h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <Tv className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('action');
            if (onUsbPress) onUsbPress();
            else universalTV.sendAction('USB_MEDIA');
          }}
          title="USB Media"
          className="h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <Usb className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('button');
            onMutePress();
          }}
          title="Mute Audio"
          className="h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <VolumeX className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>
      </div>

      {/* 3. Directional Controls & OK (Separated Buttons) */}
      <div className="flex flex-col items-center gap-1 my-1">
        {/* UP */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onDpadPress('up');
          }}
          title="Up"
          className="w-16 h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <ChevronUp className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* MIDDLE: LEFT, OK, RIGHT */}
        <div className="flex items-center gap-1 w-full justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('dpad');
              onDpadPress('left');
            }}
            title="Left"
            className="w-12 h-9 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* CENTER OK / SELECT */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('action');
              onSelectPress();
            }}
            title="OK / Select"
            className="flex-1 h-9 max-w-[74px] rounded-xl bg-gradient-to-b from-[#FFFFFF] to-[#E3E7ED] hover:from-[#F5F7FA] hover:to-[#D9DFE6] active:from-[#DDE2E9] active:to-[#CDD3DC] border border-[#C6CCD6] shadow-sm flex items-center justify-center gap-1 text-slate-800 font-bold text-xs active:scale-95 cursor-pointer"
          >
            <Play className="w-2.5 h-2.5 fill-slate-800" />
            <span>OK</span>
            <Pause className="w-2.5 h-2.5 fill-slate-800" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick('dpad');
              onDpadPress('right');
            }}
            title="Right"
            className="w-12 h-9 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* DOWN */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onDpadPress('down');
          }}
          title="Down"
          className="w-16 h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* 4. Navigation Row: Back & Home */}
      <div className="grid grid-cols-2 gap-1 w-full my-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('button');
            onBackPress();
          }}
          title="Back"
          className="h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center gap-1 text-[11px] font-bold text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <Undo2 className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('button');
            onHomePress();
          }}
          title="Home"
          className="h-8 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center gap-1 text-[11px] font-bold text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          <Home className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Home</span>
        </button>
      </div>

      {/* 5. Volume Row: Vol − & Vol + */}
      <div className="grid grid-cols-2 gap-1 w-full my-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onVolumeChange(-5);
          }}
          title="Volume Down (−)"
          className="h-8.5 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center text-xs font-bold text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          −  VOL
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick('dpad');
            onVolumeChange(5);
          }}
          title="Volume Up (+)"
          className="h-8.5 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-[#CBD1DA] border border-[#CBD1DA] flex items-center justify-center text-xs font-bold text-slate-700 active:scale-95 cursor-pointer shadow-sm"
        >
          VOL  +
        </button>
      </div>

      {/* 6. Streaming Apps Grid: YouTube, Netflix, Hotstar, Prime */}
      <div className="grid grid-cols-2 gap-1 w-full pt-1 border-t border-black/10">
        <button
          type="button"
          onClick={() => launchShortcut('youtube')}
          className="h-7.5 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
          <span>YouTube</span>
        </button>

        <button
          type="button"
          onClick={() => launchShortcut('netflix')}
          className="h-7.5 rounded-xl bg-[#E50914]/10 hover:bg-[#E50914]/20 border border-[#E50914]/30 text-[#E50914] font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
          <span>Netflix</span>
        </button>

        <button
          type="button"
          onClick={() => launchShortcut('hotstar')}
          className="h-7.5 rounded-xl bg-[#1D4ED8]/10 hover:bg-[#1D4ED8]/20 border border-[#1D4ED8]/30 text-[#1D4ED8] font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
          <span>Hotstar</span>
        </button>

        <button
          type="button"
          onClick={() => launchShortcut('prime')}
          className="h-7.5 rounded-xl bg-[#0284C7]/10 hover:bg-[#0284C7]/20 border border-[#0284C7]/30 text-[#0284C7] font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
          <span>Prime</span>
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
          isDragging ? 'cursor-grabbing' : ''
        } inline-block remote-draggable-container`}
      >
        {pebbleContent}
      </div>
    </div>
  );
}
