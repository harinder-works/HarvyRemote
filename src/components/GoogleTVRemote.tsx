import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Home,
  VolumeX,
  Power,
  Tv,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  MousePointer,
  Keyboard,
  Grid,
  Search,
  Check,
  RotateCcw,
  GripHorizontal,
  RefreshCw,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AppShortcut, PRESET_APPS, RemoteTheme } from '../types/remote';
import { AppIconRenderer, GoogleDots, GoogleAssistantLines, WebsiteEmblem } from './BrandIcons';
import { sound } from '../utils/audio';
import { SmartTVDevice, TV_BRAND_CONFIG } from '../utils/universalTVProtocol';

interface GoogleTVRemoteProps {
  theme: RemoteTheme;
  shortcut1: AppShortcut;
  shortcut2: AppShortcut;
  onUpdateShortcuts: (s1: AppShortcut, s2: AppShortcut) => void;
  onLaunchApp: (app: AppShortcut) => void;
  onDpadPress: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelectPress: () => void;
  onBackPress: () => void;
  onHomePress: () => void;
  onVoicePress: () => void;
  onMutePress: () => void;
  onPowerPress: () => void;
  onInputPress: () => void;
  onVolumeChange: (delta: number) => void;
  onSwitchToMini: () => void;
  onOpenKeyboard: () => void;
  onOpenDeviceManager: () => void;
  onCloseApp?: () => void;
  isListening: boolean;
  connectedDevice: SmartTVDevice | null;
  installedApps: AppShortcut[];
  onSyncApps: () => void;
  onAddCustomApp: (app: AppShortcut) => void;
  onDeleteApp: (appId: string) => void;
  isSyncingApps?: boolean;
}

export function GoogleTVRemote({
  theme,
  shortcut1,
  shortcut2,
  onUpdateShortcuts,
  onLaunchApp,
  onDpadPress,
  onSelectPress,
  onBackPress,
  onHomePress,
  onVoicePress,
  onMutePress,
  onPowerPress,
  onInputPress,
  onVolumeChange,
  onSwitchToMini,
  onOpenKeyboard,
  onOpenDeviceManager,
  onCloseApp,
  isListening,
  connectedDevice,
  installedApps,
  onSyncApps,
  onAddCustomApp,
  onDeleteApp,
  isSyncingApps = false,
}: GoogleTVRemoteProps) {
  // Remote Face View: 'controls' (D-Pad Face) or 'channels' (Channels Grid Face)
  const [remoteFace, setRemoteFace] = useState<'controls' | 'channels'>('controls');

  // Full remote drag position (persisted in localStorage)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 40, y: 40 };
    const saved = localStorage.getItem('gtv_full_remote_pos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(10, (window.innerWidth || 360) - 250);
          const maxY = Math.max(10, (window.innerHeight || 700) - 400);
          return {
            x: Math.min(Math.max(-50, parsed.x), maxX + 50),
            y: Math.min(Math.max(6, parsed.y), maxY + 200),
          };
        }
      } catch {}
    }
    const defaultX = Math.max(8, Math.round(((window.innerWidth || 360) - 250) / 2));
    const defaultY = Math.max(16, Math.round(((window.innerHeight || 700) - 520) / 2));
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

    const minX = -80;
    const maxX = Math.max(20, (window.innerWidth || 360) - 80);
    const minY = 6;
    const maxY = Math.max(20, (window.innerHeight || 700) - 100);

    const nextX = Math.min(Math.max(minX, dragRef.current.initialX + deltaX), maxX);
    const nextY = Math.min(Math.max(minY, dragRef.current.initialY + deltaY), maxY);

    setPosition({ x: nextX, y: nextY });
  }, []);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    setIsDragging(false);
    dragRef.current = null;
    try {
      localStorage.setItem('gtv_full_remote_pos', JSON.stringify(positionRef.current));
    } catch {}
  }, []);

  // Global listeners while actively dragging (guarantees moves are not lost even if pointer leaves element)
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

  // Keep remote inside screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(20, (window.innerWidth || 360) - 80);
        const maxY = Math.max(20, (window.innerHeight || 700) - 100);
        return {
          x: Math.min(Math.max(-80, prev.x), maxX),
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
    // Never hijack button clicks, inputs, or interactive controls
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

    // If dragged while finger is down on empty area, initiate dragging seamlessly
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
    const remoteWidth = 246;
    const defaultX = Math.max(8, Math.round((width - remoteWidth) / 2));
    const defaultY = Math.max(16, Math.round((height - 520) / 2));
    setPosition({ x: defaultX, y: defaultY });
    try {
      localStorage.setItem('gtv_full_remote_pos', JSON.stringify({ x: defaultX, y: defaultY }));
    } catch {}
    showStatus('Centered Remote');
  };

  // Custom App creation modal state
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppColor, setNewAppColor] = useState('#38bdf8');
  const [newAppCategory, setNewAppCategory] = useState('Streaming');

  // Hardware LED ref (0ms latency, zero re-renders)
  const ledRef = useRef<HTMLDivElement>(null);

  // Navigation mode for controls face: Physical D-Pad vs Swipe Trackpad
  const [controlMode, setControlMode] = useState<'dpad' | 'trackpad'>('dpad');

  // Trackpad swipe detection
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  // Channel promotion inline modal/drawer state (assigning an icon to Home Key 1 or Key 2)
  const [promotingApp, setPromotingApp] = useState<AppShortcut | null>(null);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [onRemoteStatus, setOnRemoteStatus] = useState<string | null>(null);

  // Press-and-hold timer for long press
  const pressTimer = useRef<number | null>(null);
  const isLongPressTriggered = useRef<boolean>(false);

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

  // Pure White (Snow) Pebble Theme for Google TV hardware
  const styles = {
    body: 'bg-[#EDEDF0] border-[#D9DDE2]',
    innerGroove: 'bg-[#E3E6EB]',
    dpadRing: 'bg-[#DFE3E8] border-[#CFD4DC]',
    dpadCenter: 'bg-[#EAEEF3] border-[#D5DAE2]',
    button: 'bg-[#E1E5EA] border-[#D3D8E0] text-[#3C4043] hover:bg-[#D8DCE2]',
    sideRocker: 'bg-[#DFE3E8] border-[#CCD2DC] text-[#3C4043]',
    accentLed: 'bg-cyan-400 shadow-[0_0_12px_#38bdf8]',
    logo: 'text-slate-400',
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
    if (remoteFace === 'channels') {
      setRemoteFace('controls');
      setPromotingApp(null);
    } else {
      onBackPress();
    }
  };

  const handleHome = () => {
    sound.playClick('button');
    triggerLed('home');
    if (remoteFace === 'channels') {
      setRemoteFace('controls');
    }
    onHomePress();
  };

  const handleVoice = () => {
    triggerLed('voice');
    onVoicePress();
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

  const handleInput = () => {
    sound.playClick('button');
    triggerLed('input');
    onInputPress();
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
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      handleSelect();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 25) handleDpad('right');
      else if (dx < -25) handleDpad('left');
    } else {
      if (dy > 25) handleDpad('down');
      else if (dy < -25) handleDpad('up');
    }
    setTouchStartPos(null);
  };

  // Channel Launch & Long Press Promotion Handlers
  const handleChannelTap = (app: AppShortcut) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    sound.playClick('action');
    triggerLed(`ch-${app.id}`);
    onLaunchApp(app);
    showStatus(`Playing ${app.shortLabel} on TV`);
  };

  const handleChannelLongPressStart = (app: AppShortcut) => {
    isLongPressTriggered.current = false;
    pressTimer.current = window.setTimeout(() => {
      isLongPressTriggered.current = true;
      sound.playClick('button');
      triggerLed();
      setPromotingApp(app);
    }, 450);
  };

  const handleChannelLongPressEnd = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePromoteToSlot = (slot: 1 | 2) => {
    if (!promotingApp) return;
    sound.playClick('action');
    triggerLed();
    if (slot === 1) {
      onUpdateShortcuts(promotingApp, shortcut2.id === promotingApp.id ? shortcut1 : shortcut2);
      showStatus(`Assigned to Left Home Key`);
    } else {
      onUpdateShortcuts(shortcut1.id === promotingApp.id ? shortcut2 : shortcut1, promotingApp);
      showStatus(`Assigned to Right Home Key`);
    }
    setPromotingApp(null);
  };

  const handleDemoteSlot = (slot: 1 | 2) => {
    sound.playClick('button');
    triggerLed();
    if (slot === 1) {
      const fallback = PRESET_APPS.find((a) => a.id !== shortcut2.id && a.id !== shortcut1.id) || PRESET_APPS[0];
      onUpdateShortcuts(fallback, shortcut2);
      showStatus(`Removed from Home Key 1`);
    } else {
      const fallback = PRESET_APPS.find((a) => a.id !== shortcut1.id && a.id !== shortcut2.id) || PRESET_APPS[1];
      onUpdateShortcuts(shortcut1, fallback);
      showStatus(`Removed from Home Key 2`);
    }
    setPromotingApp(null);
  };

  // Keyboard shortcut listener to close channels view or promote sub-modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (promotingApp) {
          e.preventDefault();
          setPromotingApp(null);
        } else if (remoteFace === 'channels') {
          e.preventDefault();
          setRemoteFace('controls');
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [promotingApp, remoteFace]);

  const brandInfo = connectedDevice ? TV_BRAND_CONFIG[connectedDevice.brand] : null;

  const activeAppsList = (installedApps && installedApps.length > 0) ? installedApps : PRESET_APPS;

  const filteredChannels = activeAppsList.filter(
    (app) =>
      app.name.toLowerCase().includes(channelSearchQuery.toLowerCase()) ||
      app.shortLabel.toLowerCase().includes(channelSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden select-none bg-transparent">
      <div
        onPointerDown={handlePointerDown}
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
          title="Long-press any empty area to move remote. Double-tap to center."
          className={`w-[246px] max-w-[84vw] flex flex-col justify-center rounded-[40px] border-2 bg-[#EDEDF0] remote-shadow p-2.5 pt-2 select-none text-slate-800 transition-all shadow-xl ${
            isDragging ? 'ring-2 ring-sky-400/70 shadow-2xl border-sky-300' : 'border-[#D9DDE2]'
          }`}
        >
          {/* 1. TOP HEADER APP BAR: TV Pill & Controls */}
          <div className="w-full flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/10">
            {/* TV Device Connection Pill Button */}
            <button
              type="button"
              onClick={onOpenDeviceManager}
              title={connectedDevice ? `Connected to ${connectedDevice.name} (${connectedDevice.ip})` : 'Select / Pair Smart TV'}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-[9px] font-semibold text-slate-700 transition-colors cursor-pointer shadow-sm"
            >
              <span
                className={`w-1.5 h-1.5 shrink-0 rounded-full ${
                  connectedDevice ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="truncate max-w-[65px]">
                {connectedDevice ? connectedDevice.name : 'Connect TV'}
              </span>
            </button>

            {/* Drag Handle & Re-center */}
            <div
              data-drag-handle="true"
              onClick={handleResetPosition}
              title="Drag remote anywhere on screen. Tap to re-center."
              className="p-1 rounded-full hover:bg-black/10 text-slate-400 hover:text-slate-700 transition-colors cursor-grab active:cursor-grabbing"
            >
              <GripHorizontal className="w-3.5 h-3.5 pointer-events-none" />
            </div>

            {/* Action Controls: Control Mode, Keyboard, Float/Mini Remote, and Close */}
            <div className="flex items-center gap-1">
              {/* Mode Switch (D-Pad vs Swipe Trackpad) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('button');
                  setControlMode((m) => (m === 'dpad' ? 'trackpad' : 'dpad'));
                }}
                title={controlMode === 'dpad' ? 'Switch to Swipe Trackpad' : 'Switch to D-Pad'}
                className="w-6 h-6 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-sm flex items-center justify-center"
              >
                {controlMode === 'dpad' ? <MousePointer className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
              </button>

              {/* Keyboard trigger */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('button');
                  onOpenKeyboard();
                }}
                title="Keyboard Typing for TV"
                className="w-6 h-6 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-sm flex items-center justify-center"
              >
                <Keyboard className="w-2.5 h-2.5" />
              </button>

              {/* Minimize to Mini Remote */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('action');
                  onSwitchToMini();
                }}
                title="Minimize to Mini Remote"
                className="w-6 h-6 rounded-full bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-700 transition-colors cursor-pointer shadow-sm flex items-center justify-center"
              >
                <Minimize2 className="w-2.5 h-2.5" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('soft');
                  onCloseApp?.();
                }}
                title="Close Remote & Exit"
                className="w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer shadow-sm flex items-center justify-center active:scale-95"
              >
                <X className="w-3 h-3 stroke-[2.2]" />
              </button>
            </div>
          </div>

      {/* ON-REMOTE TOAST / STATUS FEEDBACK */}
      {onRemoteStatus && (
        <div className="w-full my-1 px-2 py-0.5 rounded-full bg-sky-500 text-white text-[9px] font-bold text-center shadow-lg animate-in fade-in zoom-in duration-150 truncate">
          {onRemoteStatus}
        </div>
      )}

      {/* FACE 1: STANDARD FULL REMOTE CONTROLS */}
      {remoteFace === 'controls' && (
        <>
          {/* 2. TOP HARDWARE ROW: Power, TV Input, Mute */}
          <div className="flex items-center gap-1.5 px-0.5 mb-1.5">
            <button
              type="button"
              onClick={handlePower}
              title="TV Power"
              className="flex-1 h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Power className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleInput}
              title="TV Input Source"
              className="flex-1 h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Tv className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleMute}
              title="Mute Audio"
              className="flex-1 h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <VolumeX className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          </div>

          {/* 3. PRIMARY INTERACTION AREA: D-PAD OR SWIPE TRACKPAD */}
          <div className="w-full flex flex-col items-center justify-center my-1">
            {controlMode === 'dpad' ? (
              /* Ergonomic D-Pad Ring */
              <div className="relative w-[166px] h-[166px] flex items-center justify-center">
                {/* Directional Pad Outer Circle */}
                <div className="absolute inset-0 rounded-full bg-[#DFE3E8] border border-[#CFD4DC] dpad-groove shadow-md">
                  {/* Up */}
                  <button
                    type="button"
                    onClick={() => handleDpad('up')}
                    className="absolute top-0 left-0 right-0 h-[46px] flex items-center justify-center pt-1 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Up"
                  >
                    <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  {/* Down */}
                  <button
                    type="button"
                    onClick={() => handleDpad('down')}
                    className="absolute bottom-0 left-0 right-0 h-[46px] flex items-center justify-center pb-1 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Down"
                  >
                    <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  {/* Left */}
                  <button
                    type="button"
                    onClick={() => handleDpad('left')}
                    className="absolute left-0 top-0 bottom-0 w-[46px] flex items-center justify-center pl-1 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Left"
                  >
                    <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  {/* Right */}
                  <button
                    type="button"
                    onClick={() => handleDpad('right')}
                    className="absolute right-0 top-0 bottom-0 w-[46px] flex items-center justify-center pr-1 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Right"
                  >
                    <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Center OK Button */}
                <button
                  type="button"
                  onClick={handleSelect}
                  title="Select / OK"
                  className="relative z-10 w-[58px] h-[58px] rounded-full bg-[#EAEEF3] hover:bg-[#E2E6EC] border border-[#D5DAE2] shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer text-slate-800 font-bold text-xs tracking-wider"
                >
                  OK
                </button>
              </div>
            ) : (
              /* Swipe Touchpad */
              <div
                onPointerDown={handleTrackpadPointerDown}
                onPointerUp={handleTrackpadPointerUp}
                className="w-[168px] h-[166px] rounded-2xl bg-[#DFE3E8] border border-[#CFD4DC] shadow-inner flex flex-col items-center justify-center text-center p-2.5 cursor-pointer touch-none active:bg-[#D5D9DF] transition-colors"
              >
                <MousePointer className="w-5 h-5 text-sky-600 mb-1 opacity-80" />
                <span className="text-[10px] font-semibold text-slate-700">Swipe to Navigate</span>
                <span className="text-[9px] text-slate-500 mt-0.5">Tap to Select</span>
              </div>
            )}
          </div>

          {/* 4. CORE NAVIGATION ACTION ROW: Back, Voice Assistant, Home */}
          <div className="grid grid-cols-3 gap-1.5 px-0.5 mb-1.5">
            <button
              type="button"
              onClick={handleBack}
              title="Back"
              className="h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleVoice}
              title="Google Assistant Voice Search (Listen)"
              className={`h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm ${
                isListening ? 'ring-2 ring-sky-400 bg-sky-100' : ''
              }`}
            >
              <GoogleAssistantLines size="sm" active={isListening} />
            </button>

            <button
              type="button"
              onClick={handleHome}
              title="Home"
              className="h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Home className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* 5. VOLUME & SHORTCUTS ROW */}
          <div className="grid grid-cols-4 gap-1 px-0.5 mb-1.5">
            {/* Volume Down */}
            <button
              type="button"
              onClick={() => handleVolume(-5)}
              title="Volume Down (-)"
              className="h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-800 text-sm font-bold active:scale-95 cursor-pointer shadow-sm"
            >
              −
            </button>

            {/* Volume Up */}
            <button
              type="button"
              onClick={() => handleVolume(5)}
              title="Volume Up (+)"
              className="h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-800 text-sm font-bold active:scale-95 cursor-pointer shadow-sm"
            >
              +
            </button>

            {/* Fast Shortcut 1 */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('action');
                onLaunchApp(shortcut1);
                showStatus(`Playing ${shortcut1.shortLabel}`);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                sound.playClick('button');
                setPromotingApp(shortcut1);
                setRemoteFace('channels');
              }}
              title={`${shortcut1.name} (Hold to change)`}
              className="h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center gap-0.5 px-0.5 active:scale-95 cursor-pointer shadow-sm"
            >
              <div style={{ color: shortcut1.brandColor }} className="shrink-0 flex items-center justify-center">
                <AppIconRenderer iconType={shortcut1.iconType} className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-bold truncate text-slate-800 max-w-[28px]">{shortcut1.shortLabel}</span>
            </button>

            {/* Fast Shortcut 2 */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('action');
                onLaunchApp(shortcut2);
                showStatus(`Playing ${shortcut2.shortLabel}`);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                sound.playClick('button');
                setPromotingApp(shortcut2);
                setRemoteFace('channels');
              }}
              title={`${shortcut2.name} (Hold to change)`}
              className="h-9 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center gap-0.5 px-0.5 active:scale-95 cursor-pointer shadow-sm"
            >
              <div style={{ color: shortcut2.brandColor }} className="shrink-0 flex items-center justify-center">
                <AppIconRenderer iconType={shortcut2.iconType} className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-bold truncate text-slate-800 max-w-[28px]">{shortcut2.shortLabel}</span>
            </button>
          </div>

          {/* 6. CHANNELS TRAY TRIGGER */}
          <div className="w-full px-0.5">
            <button
              type="button"
              onClick={() => setRemoteFace('channels')}
              className="w-full h-8.5 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-slate-700 hover:text-black transition-colors cursor-pointer shadow-sm"
            >
              <Grid className="w-3.5 h-3.5 text-slate-500" />
              <span>All Channels & Apps</span>
            </button>
          </div>
        </>
      )}

      {/* FACE 2: CHANNELS & STREAMING APPS VIEW */}
      {remoteFace === 'channels' && (
        <div className="w-full flex flex-col h-[440px] max-h-[70vh] pt-0.5 pb-1 overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-1 mb-1.5">
            <button
              type="button"
              onClick={() => setRemoteFace('controls')}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-[10px] font-bold text-slate-700 hover:text-black transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1">
              {/* Sync with TV Button */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('action');
                  onSyncApps();
                  showStatus('Syncing TV apps...');
                }}
                disabled={isSyncingApps}
                title="Sync installed apps from TV"
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-300 text-[10px] font-bold text-sky-800 transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isSyncingApps ? 'animate-spin text-sky-600' : ''}`} />
                <span>{isSyncingApps ? 'Syncing...' : 'Sync TV'}</span>
              </button>

              {/* Add Custom App Button */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick('button');
                  setShowAddAppModal(true);
                }}
                title="Add any app installed on your TV"
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[10px] font-bold text-emerald-800 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Sync Status Info Bar */}
          <div className="px-1 mb-1 flex items-center justify-between text-[9px] text-slate-500 font-medium">
            <span className="truncate max-w-[140px]">
              {connectedDevice ? `TV: ${connectedDevice.name}` : 'Not connected'}
            </span>
            <span className="font-bold text-slate-600 bg-[#E1E5EA] border border-[#D0D5DC] px-1.5 py-0.2 rounded-full">
              {filteredChannels.length} Apps
            </span>
          </div>

          {/* Channel Search Bar */}
          <div className="relative mb-1.5 px-0.5">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={channelSearchQuery}
              onChange={(e) => setChannelSearchQuery(e.target.value)}
              placeholder="Search TV apps..."
              className="w-full h-8 pl-8 pr-8 rounded-xl bg-white border border-[#D0D5DC] text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-sm"
            />
            {channelSearchQuery && (
              <button
                type="button"
                onClick={() => setChannelSearchQuery('')}
                className="absolute right-2.5 top-2 p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Channels Grid with Custom Sleek Scrollbar */}
          <div className="flex-1 min-h-0 overflow-y-auto px-0.5 pr-1 custom-remote-scrollbar space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {filteredChannels.map((app) => {
                const isKey1 = shortcut1.id === app.id;
                const isKey2 = shortcut2.id === app.id;
                const isHomeKey = isKey1 || isKey2;

                return (
                  <div
                    key={app.id}
                    className="relative group"
                  >
                    <button
                      type="button"
                      onClick={() => handleChannelTap(app)}
                      onPointerDown={() => handleChannelLongPressStart(app)}
                      onPointerUp={handleChannelLongPressEnd}
                      onPointerLeave={handleChannelLongPressEnd}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        sound.playClick('button');
                        setPromotingApp(app);
                      }}
                      title={`${app.name} (${isHomeKey ? 'Assigned • ' : ''}Tap to launch, Hold to set shortcut)`}
                      className={`w-full h-11 rounded-xl border flex items-center gap-1.5 px-2 relative transition-all cursor-pointer select-none active:scale-95 shadow-sm text-left ${
                        isHomeKey
                          ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400 text-sky-900'
                          : 'bg-[#E1E5EA] hover:bg-[#D8DCE2] border-[#D0D5DC] text-slate-800'
                      }`}
                    >
                      <div style={{ color: app.brandColor }} className="shrink-0 flex items-center justify-center">
                        <AppIconRenderer iconType={app.iconType} className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold truncate max-w-[65px]">{app.name}</span>

                      {isKey1 && (
                        <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[8px] font-black flex items-center justify-center shadow-sm">
                          1
                        </span>
                      )}
                      {isKey2 && (
                        <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[8px] font-black flex items-center justify-center shadow-sm">
                          2
                        </span>
                      )}
                    </button>

                    {/* Delete / Hide App button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteApp(app.id);
                        showStatus(`Removed ${app.shortLabel}`);
                      }}
                      title={`Remove ${app.name}`}
                      className="absolute top-0.5 right-0.5 p-1 rounded-full text-slate-400 hover:text-rose-500 bg-white/80 hover:bg-white border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {filteredChannels.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <Search className="w-5 h-5 mb-1 opacity-40 text-slate-400" />
                <p className="text-[11px] font-semibold text-slate-600">No apps matching &ldquo;{channelSearchQuery}&rdquo;</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setChannelSearchQuery('')}
                    className="text-[10px] font-bold text-sky-600 hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setShowAddAppModal(true)}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    + Add &ldquo;{channelSearchQuery}&rdquo; as TV app
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Promotion Drawer */}
          {promotingApp && (
            <div className="mt-1.5 p-2 rounded-2xl bg-[#DFE3E8] border border-[#CFD4DC] shadow-xl flex flex-col items-center text-center shrink-0">
              <span className="text-[10px] font-bold text-slate-800 mb-1">Assign {promotingApp.name} to:</span>
              <div className="grid grid-cols-2 gap-1.5 w-full my-1.5">
                <button
                  type="button"
                  onClick={() => handlePromoteToSlot(1)}
                  className="h-8 rounded-xl bg-white hover:bg-slate-50 border border-[#D0D5DC] text-[10px] font-semibold text-slate-800 shadow-sm cursor-pointer"
                >
                  Shortcut 1
                </button>
                <button
                  type="button"
                  onClick={() => handlePromoteToSlot(2)}
                  className="h-8 rounded-xl bg-white hover:bg-slate-50 border border-[#D0D5DC] text-[10px] font-semibold text-slate-800 shadow-sm cursor-pointer"
                >
                  Shortcut 2
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPromotingApp(null)}
                className="text-[10px] text-slate-500 hover:text-slate-800 mt-0.5 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Modal: Add Custom Installed TV App */}
      {showAddAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs pointer-events-auto">
          <div className="w-full max-w-[280px] bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">Add TV App</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAppModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mb-3">
              Enter any app installed on your Google TV / Smart TV to add it to your remote:
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAppName.trim()) return;
                const appId = newAppName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                const customApp: AppShortcut = {
                  id: appId,
                  name: newAppName.trim(),
                  shortLabel: newAppName.trim(),
                  iconType: 'custom',
                  brandColor: newAppColor,
                  textColor: '#FFFFFF',
                  category: newAppCategory,
                  tagline: `Launch ${newAppName.trim()} on TV`,
                  heroColor: 'from-slate-900 via-slate-950 to-black',
                };
                onAddCustomApp(customApp);
                setNewAppName('');
                setShowAddAppModal(false);
                showStatus(`Added ${customApp.name}`);
              }}
              className="space-y-2.5"
            >
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  App Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SmartTube, Stremio, Kodi, Plex"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Color Tag
                </label>
                <div className="flex items-center gap-1.5">
                  {['#FF0000', '#E50914', '#00A8E1', '#113CCF', '#1DB954', '#802682', '#F47521', '#002BE7', '#10B981', '#38BDF8'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewAppColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                        newAppColor === c ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAppModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newAppName.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-40"
                >
                  Add to Remote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
