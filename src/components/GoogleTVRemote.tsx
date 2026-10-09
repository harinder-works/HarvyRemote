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
import { AppShortcut, PRESET_APPS, RemoteTheme } from '../types/remote';
import {
  YouTubeIcon,
  NetflixIcon,
  HotstarIcon,
  PrimeVideoIcon,
  JioCinemaIcon,
  SonyLivIcon,
} from './BrandIcons';
import { sound } from '../utils/audio';
import { SmartTVDevice } from '../utils/universalTVProtocol';

interface GoogleTVRemoteProps {
  theme: RemoteTheme;
  onLaunchApp: (app: AppShortcut) => void;
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
  onLaunchApp,
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
    const remoteWidth = 300;
    const defaultX = Math.max(8, Math.round((width - remoteWidth) / 2));
    const defaultY = Math.max(10, Math.round((height - 570) / 2));
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

    const minX = -100;
    const maxX = width - 100;
    const minY = 6;
    const maxY = height - 120;

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
        const maxX = Math.max(20, (window.innerWidth || 360) - 100);
        const maxY = Math.max(20, (window.innerHeight || 700) - 120);
        return {
          x: Math.min(Math.max(-80, prev.x), maxX),
          y: Math.min(Math.max(6, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for TV app launch results
  useEffect(() => {
    const handleLaunchResult = (e: any) => {
      const detail = e.detail;
      if (detail?.appSlug) {
        const appName = detail.appSlug.toUpperCase();
        if (detail.success) {
          showStatus(`Launched ${appName} on TV ✓`);
        } else {
          showStatus(`Sent launch ${appName} to TV`);
        }
      }
    };
    window.addEventListener('tv-launch-result', handleLaunchResult);
    return () => window.removeEventListener('tv-launch-result', handleLaunchResult);
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
    const remoteWidth = 290;
    const defaultX = Math.max(8, Math.round((width - remoteWidth) / 2));
    const defaultY = Math.max(16, Math.round((height - 620) / 2));
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
      ledRef.current.style.backgroundColor = '#38bdf8';
      ledRef.current.style.boxShadow = '0 0 12px #38bdf8';
      setTimeout(() => {
        if (ledRef.current) {
          ledRef.current.style.backgroundColor = '';
          ledRef.current.style.boxShadow = '';
        }
      }, 160);
    }
  };

  const showStatus = (text: string) => {
    setOnRemoteStatus(text);
    setTimeout(() => setOnRemoteStatus(null), 2200);
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

  // Launch pre-configured streaming app
  const handleLaunchAppById = (appId: string) => {
    sound.playClick('action');
    triggerLed(`app-${appId}`);
    const found = PRESET_APPS.find((a) => a.id === appId) || {
      id: appId,
      name: appId,
      shortLabel: appId,
      iconType: appId as any,
      brandColor: '#38BDF8',
      textColor: '#FFFFFF',
      category: 'Streaming',
      tagline: `Launch ${appId}`,
      heroColor: 'from-slate-900 to-black',
    };
    onLaunchApp(found);
    showStatus(`Opening ${found.shortLabel}...`);
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
        } transition-all duration-100 inline-block remote-draggable-container`}
      >
        <div
          title="Drag anywhere on blank space to move. Double-tap to center."
          className={`w-[306px] max-w-[95vw] flex flex-col justify-start rounded-[44px] border-2 bg-[#EAEDF1] border-[#D3D8DF] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.7)] p-3.5 pt-3 select-none text-slate-800 transition-all ${
            isDragging ? 'ring-2 ring-sky-400/70 shadow-2xl border-sky-300' : ''
          }`}
        >
          {/* 1. TOP HEADER APP BAR: TV Pill & Action Controls */}
          <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-black/10">
            {/* TV Device Connection Pill Button */}
            <button
              type="button"
              onClick={onOpenDeviceManager}
              title={connectedDevice ? `Connected to ${connectedDevice.name} (${connectedDevice.ip})` : 'Select / Pair Smart TV'}
              className="h-9 px-3 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] text-[11px] font-semibold text-slate-700 transition-all cursor-pointer shadow-sm flex items-center gap-2 active:scale-95"
            >
              <span
                className={`w-2 h-2 shrink-0 rounded-full ${
                  connectedDevice ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="truncate max-w-[95px]">
                {connectedDevice ? connectedDevice.name : 'Connect TV'}
              </span>
            </button>

            {/* Action Controls: Switch to Swipe Trackpad, Mini Remote, and Close */}
            <div className="flex items-center gap-2">
              {/* Mode Switch (D-Pad vs Swipe Trackpad) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('button');
                  setControlMode((m) => (m === 'dpad' ? 'trackpad' : 'dpad'));
                }}
                title={controlMode === 'dpad' ? 'Switch to Swipe Trackpad' : 'Switch to D-Pad'}
                className="w-9 h-9 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-sm flex items-center justify-center active:scale-95"
              >
                {controlMode === 'dpad' ? (
                  <MousePointer className="w-4 h-4 stroke-[2]" />
                ) : (
                  <ChevronUp className="w-4.5 h-4.5 stroke-[2]" />
                )}
              </button>

              {/* Float over other apps (Mini Remote) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('action');
                  onSwitchToMini();
                }}
                title="Float over other apps (Mini Remote)"
                className="w-9 h-9 rounded-xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-sm flex items-center justify-center active:scale-95"
              >
                <Minimize2 className="w-4 h-4 stroke-[2]" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('soft');
                  onCloseApp?.();
                }}
                title="Close Remote & Exit"
                className="w-9 h-9 rounded-xl bg-[#DEE2E8] hover:bg-rose-100 hover:text-rose-600 border border-[#CBD1DA] text-slate-700 transition-all cursor-pointer shadow-sm flex items-center justify-center active:scale-95"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          </div>

          {/* ON-REMOTE TOAST / STATUS FEEDBACK */}
          {onRemoteStatus && (
            <div className="w-full my-1 px-2.5 py-1 rounded-xl bg-slate-800 text-white text-[9.5px] font-medium text-center shadow-md animate-in fade-in zoom-in duration-150 truncate">
              {onRemoteStatus}
            </div>
          )}

          {/* 2. TOP HARDWARE ROW: Power, USB Media, Mute */}
          <div className="grid grid-cols-3 gap-2 px-0.5 mb-2">
            <button
              type="button"
              onClick={handlePower}
              title="TV Power"
              className="h-10 rounded-2xl bg-[#DEE2E8] hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 border border-[#CBD1DA] flex items-center justify-center text-slate-700 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Power className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>

            {/* USB Media Button */}
            <button
              type="button"
              onClick={handleUsb}
              title="Open USB Media / Storage"
              className="h-10 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Usb className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleMute}
              title="Mute Audio"
              className="h-10 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <VolumeX className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          </div>

          {/* 3. PRIMARY INTERACTION AREA: SEPARATED STANDALONE ARROWS OR SWIPE TRACKPAD */}
          <div className="w-full flex items-center justify-center my-2">
            {controlMode === 'dpad' ? (
              /* Completely Separated Directional Buttons Cluster */
              <div className="flex flex-col items-center justify-center select-none">
                {/* UP KEY (Independent button) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDpad('up');
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="Navigate Up"
                  className="w-[76px] h-[46px] mb-2 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-slate-300 border border-[#CBD1DA] shadow-sm flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                >
                  <ChevronUp className="w-6 h-6 stroke-[2.3]" />
                </button>

                {/* MIDDLE ROW: SEPARATED LEFT, CENTER OK, RIGHT */}
                <div className="flex items-center justify-center gap-2">
                  {/* LEFT KEY (Independent button) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDpad('left');
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Navigate Left"
                    className="w-[76px] h-[46px] rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-slate-300 border border-[#CBD1DA] shadow-sm flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                  >
                    <ChevronLeft className="w-6 h-6 stroke-[2.3]" />
                  </button>

                  {/* CENTER OK BUTTON (Independent button) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Select / OK"
                    className="w-[76px] h-[46px] rounded-2xl bg-gradient-to-b from-[#FAFBFD] to-[#DFE3E9] hover:from-white hover:to-[#D5DAE1] active:from-slate-200 active:to-slate-300 border border-[#CBD1DA] shadow-sm flex items-center justify-center cursor-pointer text-slate-800 font-bold text-xs tracking-wider transition-all active:scale-95 touch-manipulation focus:outline-none ring-1 ring-black/5"
                  >
                    OK
                  </button>

                  {/* RIGHT KEY (Independent button) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDpad('right');
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Navigate Right"
                    className="w-[76px] h-[46px] rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-slate-300 border border-[#CBD1DA] shadow-sm flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                  >
                    <ChevronRight className="w-6 h-6 stroke-[2.3]" />
                  </button>
                </div>

                {/* DOWN KEY (Independent button) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDpad('down');
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="Navigate Down"
                  className="w-[76px] h-[46px] mt-2 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] active:bg-slate-300 border border-[#CBD1DA] shadow-sm flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer touch-manipulation focus:outline-none"
                >
                  <ChevronDown className="w-6 h-6 stroke-[2.3]" />
                </button>
              </div>
            ) : (
              /* Precision Swipe Touchpad */
              <div
                onPointerDown={handleTrackpadPointerDown}
                onPointerUp={handleTrackpadPointerUp}
                className="w-[244px] h-[154px] rounded-3xl bg-[#DCE0E6] border border-[#CBD1DA] shadow-inner flex flex-col items-center justify-center text-center p-3 cursor-pointer touch-none active:bg-[#D5DAE1] transition-colors mx-auto"
              >
                <MousePointer className="w-6 h-6 text-slate-700 stroke-[2] mb-1.5 opacity-80" />
                <span className="text-xs font-semibold text-slate-700">Swipe to Navigate</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Tap to Select</span>
              </div>
            )}
          </div>

          {/* 4. CORE NAVIGATION ROW: BACK & HOME */}
          <div className="grid grid-cols-2 gap-2 w-full my-1">
            <button
              type="button"
              onClick={handleBack}
              title="Back"
              className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4.5 h-4.5 stroke-[2.2]" />
              <span className="text-xs font-semibold">Back</span>
            </button>

            <button
              type="button"
              onClick={handleHome}
              title="Home"
              className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Home className="w-4.5 h-4.5 stroke-[2.2]" />
              <span className="text-xs font-semibold">Home</span>
            </button>
          </div>

          {/* 5. VOLUME CONTROLS ROW */}
          <div className="grid grid-cols-2 gap-2 w-full mb-2">
            <button
              type="button"
              onClick={() => handleVolume(-5)}
              title="Volume Down (−)"
              className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="text-lg leading-none font-bold text-slate-600">−</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vol</span>
            </button>

            <button
              type="button"
              onClick={() => handleVolume(5)}
              title="Volume Up (+)"
              className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-[#D5DAE1] border border-[#CBD1DA] flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vol</span>
              <span className="text-lg leading-none font-bold text-slate-600">+</span>
            </button>
          </div>

          {/* 6. DEDICATED STREAMING APPS (6 Fast Shortcuts within Home Page) */}
          <div className="w-full pt-2 border-t border-black/10">
            <div className="grid grid-cols-2 gap-2 w-full">
              {/* 1. YouTube */}
              <button
                type="button"
                onClick={() => handleLaunchAppById('youtube')}
                title="Launch YouTube"
                className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-white hover:border-red-300 border border-[#CBD1DA] flex items-center justify-center gap-2 px-2.5 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="text-red-600 flex items-center justify-center shrink-0">
                  <YouTubeIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold truncate">YouTube</span>
              </button>

              {/* 2. Netflix */}
              <button
                type="button"
                onClick={() => handleLaunchAppById('netflix')}
                title="Launch Netflix"
                className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-white hover:border-red-300 border border-[#CBD1DA] flex items-center justify-center gap-2 px-2.5 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="text-[#E50914] flex items-center justify-center shrink-0">
                  <NetflixIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold truncate">Netflix</span>
              </button>

              {/* 3. Disney+ Hotstar */}
              <button
                type="button"
                onClick={() => handleLaunchAppById('hotstar')}
                title="Launch Disney+ Hotstar"
                className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-white hover:border-blue-300 border border-[#CBD1DA] flex items-center justify-center gap-2 px-2.5 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="text-[#1259D4] flex items-center justify-center shrink-0">
                  <HotstarIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold truncate">Hotstar</span>
              </button>

              {/* 4. Prime Video */}
              <button
                type="button"
                onClick={() => handleLaunchAppById('prime')}
                title="Launch Prime Video"
                className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-white hover:border-sky-300 border border-[#CBD1DA] flex items-center justify-center gap-2 px-2.5 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="text-[#00A8E1] flex items-center justify-center shrink-0">
                  <PrimeVideoIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold truncate">Prime Video</span>
              </button>

              {/* 5. JioCinema */}
              <button
                type="button"
                onClick={() => handleLaunchAppById('jiocinema')}
                title="Launch JioCinema"
                className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-white hover:border-pink-300 border border-[#CBD1DA] flex items-center justify-center gap-2 px-2.5 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="text-[#D81977] flex items-center justify-center shrink-0">
                  <JioCinemaIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold truncate">JioCinema</span>
              </button>

              {/* 6. Sony LIV */}
              <button
                type="button"
                onClick={() => handleLaunchAppById('sonyliv')}
                title="Launch Sony LIV"
                className="h-10.5 rounded-2xl bg-[#DEE2E8] hover:bg-white hover:border-blue-300 border border-[#CBD1DA] flex items-center justify-center gap-2 px-2.5 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="text-[#307FE2] flex items-center justify-center shrink-0 font-bold">
                  <SonyLivIcon className="w-3.5 h-3" />
                </div>
                <span className="text-xs font-semibold truncate">Sony LIV</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
