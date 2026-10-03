import React, { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  GripHorizontal,
  ArrowLeft,
  Home,
  VolumeX,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Power,
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

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Keep inside screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(8, window.innerWidth - 170);
        const maxY = Math.max(8, window.innerHeight - 320);
        return {
          x: Math.min(Math.max(8, prev.x), maxX),
          y: Math.min(Math.max(8, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const maxX = Math.max(8, window.innerWidth - 170);
    const maxY = Math.max(8, window.innerHeight - 320);

    const newX = Math.min(Math.max(8, dragStartRef.current.initialX + deltaX), maxX);
    const newY = Math.min(Math.max(8, dragStartRef.current.initialY + deltaY), maxY);

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragStartRef.current = null;
      localStorage.setItem('gtv_mini_remote_pos', JSON.stringify(position));
    }
  };

  // Remote pebble content
  const pebbleContent = (
    <div
      className="w-[158px] max-w-[96vw] rounded-[32px] border-2 border-[#D9DDE2] bg-[#EDEDF0] text-slate-800 p-2 select-none remote-shadow flex flex-col items-center shrink-0 my-auto"
    >
      {/* Top Controls (Power & Expand) */}
      <div className="w-full flex items-center justify-between pb-1 mb-1 border-b border-black/10 select-none cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1 pl-1 py-0.5 min-w-0 max-w-[85px]">
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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          willChange: 'transform',
        }}
        className={`pointer-events-auto touch-none cursor-grab ${
          isDragging ? 'cursor-grabbing shadow-2xl scale-[1.02]' : ''
        } transition-shadow duration-150 inline-block`}
      >
        {pebbleContent}
      </div>
    </div>
  );
}
