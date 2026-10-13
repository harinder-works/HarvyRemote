import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Home,
  VolumeX,
  Power,
  Usb,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  MousePointer,
  X,
} from 'lucide-react';
import { AppShortcut, RemoteTheme } from '../types/remote';
import { sound } from '../utils/audio';
import { SmartTVDevice } from '../utils/universalTVProtocol';

interface GoogleTVRemoteProps {
  theme?: RemoteTheme;
  onLaunchApp?: (app: AppShortcut) => void;
  onDpadPress: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelectPress: () => void;
  onBackPress: () => void;
  onHomePress: () => void;
  onMutePress: () => void;
  onPowerPress: () => void;
  onInputPress?: () => void;
  onUsbPress?: () => void;
  onVolumeChange: (delta: number) => void;
  onSwitchToMini: () => void;
  onOpenDeviceManager: () => void;
  onCloseApp?: () => void;
  connectedDevice: SmartTVDevice | null;
}

export function GoogleTVRemote({
  onDpadPress,
  onSelectPress,
  onBackPress,
  onHomePress,
  onMutePress,
  onPowerPress,
  onInputPress,
  onUsbPress,
  onVolumeChange,
  onSwitchToMini,
  onOpenDeviceManager,
  onCloseApp,
  connectedDevice,
}: GoogleTVRemoteProps) {
  // Sleek remote pebble width (224px)
  const REMOTE_WIDTH = 224;
  const REMOTE_HEIGHT = 440;

  // Free dragging position state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('gtv_full_remote_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}

    const width = typeof window !== 'undefined' ? window.innerWidth : 360;
    const height = typeof window !== 'undefined' ? window.innerHeight : 700;
    const defaultX = Math.max(8, Math.round((width - REMOTE_WIDTH) / 2));
    const defaultY = Math.max(12, Math.round((height - REMOTE_HEIGHT) / 2));
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const startDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const dx = clientX - dragStartRef.current.startX;
    const dy = clientY - dragStartRef.current.startY;
    const width = window.innerWidth || 360;
    const height = window.innerHeight || 700;

    const minX = -80;
    const maxX = width - 80;
    const minY = 6;
    const maxY = height - 100;

    const newX = Math.min(Math.max(minX, dragStartRef.current.initialX + dx), maxX);
    const newY = Math.min(Math.max(minY, dragStartRef.current.initialY + dy), maxY);

    setPosition({ x: newX, y: newY });
  };

  const endDrag = () => {
    setIsDragging(false);
    try {
      localStorage.setItem('gtv_full_remote_pos', JSON.stringify(position));
    } catch {}
  };

  // Re-adjust position if viewport resizes
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(20, (window.innerWidth || 360) - 80);
        const maxY = Math.max(20, (window.innerHeight || 700) - 100);
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

  // Pointer drag handler: Long-pressing on any empty area of the remote body initiates dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('[data-no-drag]')) {
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
      showStatus('Dragging Remote');
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
        showStatus('Dragging Remote');
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

  // Touch drag handler for mobile and Android WebView
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('[data-no-drag]')) {
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
      showStatus('Dragging Remote');
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
        showStatus('Dragging Remote');
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
    const width = window.innerWidth || 360;
    const height = window.innerHeight || 700;
    const defaultX = Math.max(8, Math.round((width - REMOTE_WIDTH) / 2));
    const defaultY = Math.max(12, Math.round((height - REMOTE_HEIGHT) / 2));
    setPosition({ x: defaultX, y: defaultY });
    try {
      localStorage.setItem('gtv_full_remote_pos', JSON.stringify({ x: defaultX, y: defaultY }));
    } catch {}
    showStatus('Centered Remote');
  };

  // Hardware LED ref (0ms latency, zero re-renders)
  const ledRef = useRef<HTMLDivElement>(null);

  // Navigation mode for controls face: Physical D-Pad vs Swipe Trackpad
  const [controlMode, setControlMode] = useState<'dpad' | 'trackpad'>('dpad');

  // Trackpad swipe detection
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  const [onRemoteStatus, setOnRemoteStatus] = useState<string | null>(null);

  const triggerLed = (_label?: string) => {
    if (ledRef.current) {
      ledRef.current.style.backgroundColor = '#0284C7';
      ledRef.current.style.boxShadow = '0 0 10px #38BDF8';
      setTimeout(() => {
        if (ledRef.current) {
          ledRef.current.style.backgroundColor = '';
          ledRef.current.style.boxShadow = '';
        }
      }, 150);
    }
  };

  const showStatus = (text: string) => {
    setOnRemoteStatus(text);
    setTimeout(() => setOnRemoteStatus(null), 2000);
  };

  const handleDpad = (dir: 'up' | 'down' | 'left' | 'right') => {
    sound.playClick('dpad');
    triggerLed(`dpad-${dir}`);
    onDpadPress(dir);
  };

  const handleSelect = () => {
    sound.playClick('action');
    triggerLed('dpad-select');
    onSelectPress();
  };

  const handleBack = () => {
    sound.playClick('button');
    triggerLed('back');
    onBackPress();
  };

  const handleHome = () => {
    sound.playClick('button');
    triggerLed('home');
    onHomePress();
  };

  const handleMute = () => {
    sound.playClick('button');
    triggerLed('mute');
    onMutePress();
  };

  const handlePower = () => {
    sound.playClick('action');
    triggerLed('power');
    onPowerPress();
  };

  const handleUsb = () => {
    sound.playClick('action');
    triggerLed('usb');
    showStatus('Opening USB Media...');
    if (onUsbPress) {
      onUsbPress();
    } else if (onInputPress) {
      onInputPress();
    }
  };

  const handleVolume = (delta: number) => {
    sound.playClick('dpad');
    triggerLed(delta > 0 ? 'vol-up' : 'vol-down');
    onVolumeChange(delta);
  };

  // Trackpad swipe handlers
  const handleTrackpadPointerDown = (e: React.PointerEvent) => {
    setTouchStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleTrackpadPointerUp = (e: React.PointerEvent) => {
    if (!touchStartPos) return;
    const dx = e.clientX - touchStartPos.x;
    const dy = e.clientY - touchStartPos.y;
    const threshold = 18;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      handleSelect();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) handleDpad('right');
      else handleDpad('left');
    } else {
      if (dy > 0) handleDpad('down');
      else handleDpad('up');
    }
    setTouchStartPos(null);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden select-none bg-transparent">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('input')) {
            handleResetPosition(e);
          }
        }}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          willChange: 'transform',
        }}
        className={`pointer-events-auto touch-none ${
          isDragging ? 'cursor-grabbing shadow-2xl scale-[1.02]' : 'cursor-grab'
        } transition-transform duration-75 inline-block remote-draggable-container`}
      >
        {/* SLEEK ERGONOMIC PEBBLE CASING */}
        <div
          title="Drag anywhere on blank space to move. Double-tap to center."
          className={`w-[224px] max-w-[92vw] flex flex-col justify-start rounded-[38px] border-2 bg-gradient-to-b from-[#FAFBFD] via-[#ECEFF4] to-[#DFE3E9] border-[#CBD3DE] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.9)_inset] p-3 pt-2.5 select-none text-slate-800 transition-shadow ${
            isDragging ? 'ring-2 ring-sky-400/80 shadow-2xl border-sky-300' : ''
          }`}
        >
          {/* TOP DRAG GRIP + HARDWARE LED INDICATOR */}
          <div className="w-full flex items-center justify-center relative pb-1 pt-0.5">
            <div className="w-8 h-1 rounded-full bg-slate-300/80" />
            <div
              ref={ledRef}
              className="absolute right-1 top-0.5 w-1.5 h-1.5 rounded-full bg-transparent transition-all duration-150"
            />
          </div>

          {/* 1. TOP HEADER APP BAR: TV Pill & Utility Buttons */}
          <div className="w-full flex items-center justify-between pb-1.5 mb-2 border-b border-black/10">
            {/* TV Device Connection Pill Button */}
            <button
              type="button"
              onClick={onOpenDeviceManager}
              title={connectedDevice ? `Connected to ${connectedDevice.name}` : 'Pair Smart TV'}
              className="h-8 px-2.5 rounded-xl bg-gradient-to-b from-white to-[#E7EBF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] text-[10.5px] font-semibold text-slate-700 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center gap-1.5 active:scale-95"
            >
              <span
                className={`w-2 h-2 shrink-0 rounded-full ${
                  connectedDevice ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="truncate max-w-[70px]">
                {connectedDevice ? connectedDevice.name : 'Connect'}
              </span>
            </button>

            {/* Utility Controls: Mode Switch, Mini Remote, and Close */}
            <div className="flex items-center gap-1.5">
              {/* Mode Switch (D-Pad vs Swipe Trackpad) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('button');
                  setControlMode((m) => (m === 'dpad' ? 'trackpad' : 'dpad'));
                }}
                title={controlMode === 'dpad' ? 'Switch to Trackpad' : 'Switch to D-Pad'}
                className="w-8 h-8 rounded-xl bg-gradient-to-b from-white to-[#E7EBF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center active:scale-95"
              >
                {controlMode === 'dpad' ? (
                  <MousePointer className="w-3.5 h-3.5 stroke-[2]" />
                ) : (
                  <ChevronUp className="w-4 h-4 stroke-[2.2]" />
                )}
              </button>

              {/* Picture-in-Picture Mini Remote */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('action');
                  onSwitchToMini();
                }}
                title="Mini Remote"
                className="w-8 h-8 rounded-xl bg-gradient-to-b from-white to-[#E7EBF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center active:scale-95"
              >
                <Minimize2 className="w-3.5 h-3.5 stroke-[2]" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('soft');
                  onCloseApp?.();
                }}
                title="Close Remote"
                className="w-8 h-8 rounded-xl bg-gradient-to-b from-white to-[#E7EBF0] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-[#CBD2DC] text-slate-700 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center active:scale-95"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* ON-REMOTE TOAST / STATUS FEEDBACK */}
          {onRemoteStatus && (
            <div className="w-full mb-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 text-white text-[9px] font-medium text-center shadow-md animate-in fade-in zoom-in duration-150 truncate backdrop-blur-sm">
              {onRemoteStatus}
            </div>
          )}

          {/* 2. TOP HARDWARE ROW: Power, USB Media, Mute */}
          <div className="grid grid-cols-3 gap-1.5 px-0.5 mb-2">
            <button
              type="button"
              onClick={handlePower}
              title="TV Power"
              className="h-9 rounded-xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-emerald-50 hover:text-emerald-600 hover:border-emerald-300 border border-[#CBD2DC] flex items-center justify-center text-slate-700 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <Power className="w-4 h-4 stroke-[2.2]" />
            </button>

            {/* USB Media Button */}
            <button
              type="button"
              onClick={handleUsb}
              title="USB Media"
              className="h-9 rounded-xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] flex items-center justify-center gap-1 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <Usb className="w-3.5 h-3.5 stroke-[2.2]" />
              <span className="text-[10px] font-bold">USB</span>
            </button>

            <button
              type="button"
              onClick={handleMute}
              title="Mute Audio"
              className="h-9 rounded-xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <VolumeX className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* 3. PRIMARY INTERACTION AREA: SLEEK D-PAD OR SWIPE TRACKPAD */}
          <div className="w-full flex items-center justify-center my-1.5">
            {controlMode === 'dpad' ? (
              /* Sleek Directional Buttons Cluster */
              <div className="flex flex-col items-center justify-center select-none w-full">
                {/* UP KEY */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDpad('up');
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="Navigate Up"
                  className="w-[66px] h-[42px] mb-1.5 rounded-2xl bg-gradient-to-b from-white to-[#E5E9F0] hover:from-white hover:to-[#DCE1E8] active:from-slate-200 active:to-slate-300 border border-[#CBD2DC] shadow-[0_2px_4px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.9)_inset] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                >
                  <ChevronUp className="w-5 h-5 stroke-[2.4]" />
                </button>

                {/* MIDDLE ROW: LEFT, CENTER OK, RIGHT */}
                <div className="flex items-center justify-between w-full px-0.5">
                  {/* LEFT KEY */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDpad('left');
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Navigate Left"
                    className="w-[60px] h-[42px] rounded-2xl bg-gradient-to-b from-white to-[#E5E9F0] hover:from-white hover:to-[#DCE1E8] active:from-slate-200 active:to-slate-300 border border-[#CBD2DC] shadow-[0_2px_4px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.9)_inset] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                  >
                    <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
                  </button>

                  {/* CENTER OK BUTTON */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Select / OK"
                    className="w-[66px] h-[42px] rounded-2xl bg-gradient-to-b from-[#FFFFFF] via-[#FAFBFD] to-[#D9DFE8] hover:from-white hover:to-[#CED5E0] active:from-slate-200 active:to-slate-300 border border-[#BAC3CF] shadow-[0_2px_5px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.95)_inset] flex items-center justify-center cursor-pointer text-slate-900 font-bold text-xs tracking-wider transition-all active:scale-95 touch-manipulation focus:outline-none ring-1 ring-black/5"
                  >
                    OK
                  </button>

                  {/* RIGHT KEY */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDpad('right');
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Navigate Right"
                    className="w-[60px] h-[42px] rounded-2xl bg-gradient-to-b from-white to-[#E5E9F0] hover:from-white hover:to-[#DCE1E8] active:from-slate-200 active:to-slate-300 border border-[#CBD2DC] shadow-[0_2px_4px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.9)_inset] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                  >
                    <ChevronRight className="w-5 h-5 stroke-[2.4]" />
                  </button>
                </div>

                {/* DOWN KEY */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDpad('down');
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="Navigate Down"
                  className="w-[66px] h-[42px] mt-1.5 rounded-2xl bg-gradient-to-b from-white to-[#E5E9F0] hover:from-white hover:to-[#DCE1E8] active:from-slate-200 active:to-slate-300 border border-[#CBD2DC] shadow-[0_2px_4px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.9)_inset] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                >
                  <ChevronDown className="w-5 h-5 stroke-[2.4]" />
                </button>
              </div>
            ) : (
              /* Precision Swipe Touchpad */
              <div
                onPointerDown={handleTrackpadPointerDown}
                onPointerUp={handleTrackpadPointerUp}
                className="w-full h-[142px] rounded-3xl bg-gradient-to-b from-[#E2E6EC] to-[#D5DAE1] border border-[#CBD2DC] shadow-inner flex flex-col items-center justify-center text-center p-3 cursor-pointer touch-none active:bg-[#CCD1D9] transition-colors"
              >
                <MousePointer className="w-5 h-5 text-slate-700 stroke-[2] mb-1 opacity-80" />
                <span className="text-[11px] font-semibold text-slate-700">Swipe to Navigate</span>
                <span className="text-[9.5px] text-slate-500 mt-0.5">Tap to Select</span>
              </div>
            )}
          </div>

          {/* 4. CORE NAVIGATION ROW: BACK & HOME */}
          <div className="grid grid-cols-2 gap-1.5 w-full my-1.5 px-0.5">
            <button
              type="button"
              onClick={handleBack}
              title="Back"
              className="h-10 rounded-2xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] flex items-center justify-center gap-1.5 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="text-[11.5px] font-semibold">Back</span>
            </button>

            <button
              type="button"
              onClick={handleHome}
              title="Home"
              className="h-10 rounded-2xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] flex items-center justify-center gap-1.5 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <Home className="w-4 h-4 stroke-[2.2]" />
              <span className="text-[11.5px] font-semibold">Home</span>
            </button>
          </div>

          {/* 5. VOLUME CONTROLS ROW */}
          <div className="grid grid-cols-2 gap-1.5 w-full mb-1 px-0.5">
            <button
              type="button"
              onClick={() => handleVolume(-5)}
              title="Volume Down (−)"
              className="h-10 rounded-2xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] flex items-center justify-center gap-1.5 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <span className="text-base leading-none font-bold text-slate-600">−</span>
              <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Vol</span>
            </button>

            <button
              type="button"
              onClick={() => handleVolume(5)}
              title="Volume Up (+)"
              className="h-10 rounded-2xl bg-gradient-to-b from-white to-[#E6EAF0] hover:from-white hover:to-[#DDE2E9] border border-[#CBD2DC] flex items-center justify-center gap-1.5 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
              <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Vol</span>
              <span className="text-base leading-none font-bold text-slate-600">+</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
