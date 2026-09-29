import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { GoogleDots } from './BrandIcons';
import { sound } from '../utils/audio';
import { RemoteTheme } from '../types/remote';

interface MiniRemoteProps {
  isOpen: boolean;
  theme: RemoteTheme;
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
  isTVOn,
}: MiniRemoteProps) {
  // Default position: bottom-right corner
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize position to bottom right corner once mounted
  useEffect(() => {
    if (typeof window !== 'undefined' && position === null) {
      const defaultX = Math.max(16, window.innerWidth - 200);
      const defaultY = Math.max(16, window.innerHeight - 370);
      setPosition({ x: defaultX, y: defaultY });
    }
  }, [position]);


  // Touch-based dragging for rock-solid Android responsiveness
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      const currentX = position?.x ?? (window.innerWidth - 200);
      const currentY = position?.y ?? (window.innerHeight - 370);

      dragStartRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        initialX: currentX,
        initialY: currentY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStartRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];

    const deltaX = touch.clientX - dragStartRef.current.startX;
    const deltaY = touch.clientY - dragStartRef.current.startY;

    const newX = dragStartRef.current.initialX + deltaX;
    const newY = dragStartRef.current.initialY + deltaY;

    const width = 184;
    const height = 350;
    const clampedX = Math.min(Math.max(8, newX), window.innerWidth - width - 8);
    const clampedY = Math.min(Math.max(8, newY), window.innerHeight - height - 8);

    setPosition({ x: clampedX, y: clampedY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return; // Handled by TouchEvent for Android
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    if (!containerRef.current) return;
    setIsDragging(true);
    containerRef.current.setPointerCapture(e.pointerId);

    const currentX = position?.x ?? (window.innerWidth - 200);
    const currentY = position?.y ?? (window.innerHeight - 370);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY,
    };
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!isDragging || !dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      const newX = dragStartRef.current.initialX + deltaX;
      const newY = dragStartRef.current.initialY + deltaY;

      const width = 184;
      const height = 350;
      const clampedX = Math.min(Math.max(8, newX), window.innerWidth - width - 8);
      const clampedY = Math.min(Math.max(8, newY), window.innerHeight - height - 8);

      setPosition({ x: clampedX, y: clampedY });
    },
    [isDragging]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (isDragging && containerRef.current) {
      try {
        containerRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  if (!isOpen) return null;

  // Pure White Google TV Pebble styling
  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: position ? `translate3d(${position.x}px, ${position.y}px, 0)` : undefined,
        touchAction: 'none',
      }}
      className={`fixed top-0 left-0 z-50 w-[184px] rounded-[44px] border-2 border-[#D9DDE2] bg-[#EDEDF0] text-slate-800 p-3 select-none remote-shadow transition-shadow ${
        isDragging ? 'shadow-sky-500/30 ring-2 ring-sky-400 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Drag Grip Handle & Top Controls (Primary drag target) */}
      <div
        className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/10 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-1.5 pl-1.5 py-1">
          <GripHorizontal className="w-5 h-5 text-slate-500 animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Drag</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Power Button */}
          <button
            onClick={() => {
              sound.playClick('action');
              onPowerPress();
            }}
            title="TV Power"
            className="p-1.5 rounded-full hover:bg-black/10 text-emerald-600 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
          </button>

          {/* Expand to Full Remote Button */}
          <button
            onClick={() => {
              sound.playClick('action');
              onExpand();
            }}
            title="Expand to Full Remote"
            className="p-1.5 rounded-full hover:bg-black/10 text-sky-600 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mini D-Pad */}
      <div className="relative w-[116px] h-[116px] mx-auto my-1.5 flex items-center justify-center">
        {/* Directional Pad Ring */}
        <div className="absolute inset-0 rounded-full bg-[#DFE3E8] border border-[#CFD4DC] dpad-groove">
          {/* Up */}
          <button
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('up');
            }}
            title="Up"
            className="absolute top-0 left-0 right-0 h-9 flex items-center justify-center pt-1 text-slate-600 hover:text-black active:scale-90 transition-transform"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          {/* Down */}
          <button
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('down');
            }}
            title="Down"
            className="absolute bottom-0 left-0 right-0 h-9 flex items-center justify-center pb-1 text-slate-600 hover:text-black active:scale-90 transition-transform"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          {/* Left */}
          <button
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('left');
            }}
            title="Left"
            className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center pl-1 text-slate-600 hover:text-black active:scale-90 transition-transform"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {/* Right */}
          <button
            onClick={() => {
              sound.playClick('dpad');
              onDpadPress('right');
            }}
            title="Right"
            className="absolute right-0 top-0 bottom-0 w-9 flex items-center justify-center pr-1 text-slate-600 hover:text-black active:scale-90 transition-transform"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center OK */}
        <button
          onClick={() => {
            sound.playClick('action');
            onSelectPress();
          }}
          title="Select / OK"
          className="relative z-10 w-11 h-11 rounded-full bg-[#EAEEF3] border border-[#D5DAE2] remote-button-shadow active:scale-90 transition-transform flex items-center justify-center text-xs font-bold text-slate-700"
        >
          OK
        </button>
      </div>

      {/* Row 1: Back, Voice Assistant, Home */}
      <div className="grid grid-cols-3 gap-2 my-1.5">
        <button
          onClick={() => {
            sound.playClick('button');
            onBackPress();
          }}
          title="Back"
          className="h-9 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          onClick={onVoicePress}
          title="Voice Search"
          className={`h-9 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all ${
            isListening ? 'ring-2 ring-sky-400 bg-sky-100' : ''
          }`}
        >
          <GoogleDots className="w-4 h-4" active={isListening} />
        </button>

        <button
          onClick={() => {
            sound.playClick('button');
            onHomePress();
          }}
          title="Home"
          className="h-9 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all text-slate-700"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* Row 2: Volume Controls & Mute */}
      <div className="grid grid-cols-3 gap-2 my-1">
        <button
          onClick={() => {
            sound.playClick('dpad');
            onVolumeChange(-5);
          }}
          title="Volume Down"
          className="h-8 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-xs font-bold text-slate-700"
        >
          −
        </button>

        <button
          onClick={() => {
            sound.playClick('button');
            onMutePress();
          }}
          title="Mute"
          className="h-8 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-slate-700"
        >
          <VolumeX className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            sound.playClick('dpad');
            onVolumeChange(5);
          }}
          title="Volume Up"
          className="h-8 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-xs font-bold text-slate-700"
        >
          +
        </button>
      </div>

      {/* Footer instruction */}
      <div className="pt-1.5 text-center">
        <span className="text-[9px] text-slate-500 font-medium">Drag anywhere · Tap ↗ to expand</span>
      </div>
    </div>
  );
}
