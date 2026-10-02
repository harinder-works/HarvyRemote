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
  isListening: boolean;
  connectedDevice: SmartTVDevice | null;
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
  isListening,
  connectedDevice,
}: GoogleTVRemoteProps) {
  // Remote Face View: 'controls' (D-Pad Face) or 'channels' (Channels Grid Face)
  const [remoteFace, setRemoteFace] = useState<'controls' | 'channels'>('controls');

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

  const filteredChannels = PRESET_APPS.filter(
    (app) =>
      app.name.toLowerCase().includes(channelSearchQuery.toLowerCase()) ||
      app.shortLabel.toLowerCase().includes(channelSearchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-[356px] mx-auto flex flex-col justify-center my-auto rounded-[46px] border-2 border-[#D9DDE2] bg-[#EDEDF0] remote-shadow p-3.5 sm:p-4 select-none text-slate-800 transition-all shadow-xl">
      {/* 1. TOP HEADER APP BAR: TV Pill & Controls */}
      <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-black/10">
        {/* TV Device Connection Pill Button */}
        <button
          type="button"
          onClick={onOpenDeviceManager}
          title={connectedDevice ? `Connected to ${connectedDevice.name} (${connectedDevice.ip})` : 'Select / Pair Smart TV'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer shadow-sm"
        >
          <span
            className={`w-2 h-2 shrink-0 rounded-full ${
              connectedDevice ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="truncate max-w-[120px]">
            {connectedDevice ? connectedDevice.name : 'Connect TV'}
          </span>
        </button>

        {/* Action Controls: Control Mode, Keyboard, and Float/Mini Remote */}
        <div className="flex items-center gap-1.5">
          {/* Mode Switch (D-Pad vs Swipe Trackpad) */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('button');
              setControlMode((m) => (m === 'dpad' ? 'trackpad' : 'dpad'));
            }}
            title={controlMode === 'dpad' ? 'Switch to Swipe Trackpad' : 'Switch to D-Pad'}
            className="p-1.5 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-sm"
          >
            {controlMode === 'dpad' ? <MousePointer className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Keyboard trigger */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('button');
              onOpenKeyboard();
            }}
            title="Keyboard Typing for TV"
            className="p-1.5 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-sm"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* Minimize to Mini Remote */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('action');
              onSwitchToMini();
            }}
            title="Minimize to Mini Remote"
            className="p-1.5 rounded-full bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-700 transition-colors cursor-pointer shadow-sm"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ON-REMOTE TOAST / STATUS FEEDBACK */}
      {onRemoteStatus && (
        <div className="w-full my-1.5 px-3 py-1 rounded-full bg-sky-500 text-white text-[11px] font-bold text-center shadow-lg animate-in fade-in zoom-in duration-150 truncate">
          {onRemoteStatus}
        </div>
      )}

      {/* FACE 1: STANDARD FULL REMOTE CONTROLS */}
      {remoteFace === 'controls' && (
        <>
          {/* 2. TOP HARDWARE ROW: Power, TV Input, Mute */}
          <div className="flex items-center gap-2.5 px-0.5 mb-2.5">
            <button
              type="button"
              onClick={handlePower}
              title="TV Power"
              className="flex-1 h-11 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Power className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleInput}
              title="TV Input Source"
              className="flex-1 h-11 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Tv className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleMute}
              title="Mute Audio"
              className="flex-1 h-11 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <VolumeX className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          </div>

          {/* 3. PRIMARY INTERACTION AREA: LARGE D-PAD OR SWIPE TRACKPAD */}
          <div className="w-full flex flex-col items-center justify-center my-1.5">
            {controlMode === 'dpad' ? (
              /* Ergonomic D-Pad Ring */
              <div className="relative w-[min(70vw,232px)] h-[min(70vw,232px)] flex items-center justify-center">
                {/* Directional Pad Outer Circle */}
                <div className="absolute inset-0 rounded-full bg-[#DFE3E8] border border-[#CFD4DC] dpad-groove shadow-md">
                  {/* Up */}
                  <button
                    type="button"
                    onClick={() => handleDpad('up')}
                    className="absolute top-0 left-0 right-0 h-[64px] flex items-center justify-center pt-1.5 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Up"
                  >
                    <ChevronUp className="w-7 h-7 stroke-[2.5]" />
                  </button>
                  {/* Down */}
                  <button
                    type="button"
                    onClick={() => handleDpad('down')}
                    className="absolute bottom-0 left-0 right-0 h-[64px] flex items-center justify-center pb-1.5 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Down"
                  >
                    <ChevronDown className="w-7 h-7 stroke-[2.5]" />
                  </button>
                  {/* Left */}
                  <button
                    type="button"
                    onClick={() => handleDpad('left')}
                    className="absolute left-0 top-0 bottom-0 w-[64px] flex items-center justify-center pl-1.5 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Left"
                  >
                    <ChevronLeft className="w-7 h-7 stroke-[2.5]" />
                  </button>
                  {/* Right */}
                  <button
                    type="button"
                    onClick={() => handleDpad('right')}
                    className="absolute right-0 top-0 bottom-0 w-[64px] flex items-center justify-center pr-1.5 cursor-pointer text-slate-600 hover:text-black active:scale-95 transition-all"
                    title="Navigate Right"
                  >
                    <ChevronRight className="w-7 h-7 stroke-[2.5]" />
                  </button>
                </div>

                {/* Center OK Button */}
                <button
                  type="button"
                  onClick={handleSelect}
                  title="Select / OK"
                  className="relative z-10 w-[80px] h-[80px] rounded-full bg-[#EAEEF3] hover:bg-[#E2E6EC] border border-[#D5DAE2] shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer text-slate-800 font-bold text-sm tracking-wider"
                >
                  OK
                </button>
              </div>
            ) : (
              /* Swipe Touchpad */
              <div
                onPointerDown={handleTrackpadPointerDown}
                onPointerUp={handleTrackpadPointerUp}
                className="w-[min(72vw,240px)] h-[min(70vw,232px)] rounded-3xl bg-[#DFE3E8] border border-[#CFD4DC] shadow-inner flex flex-col items-center justify-center text-center p-4 cursor-pointer touch-none active:bg-[#D5D9DF] transition-colors"
              >
                <MousePointer className="w-7 h-7 text-sky-600 mb-1.5 opacity-80" />
                <span className="text-xs font-semibold text-slate-700">Swipe to Navigate</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Tap to Select</span>
              </div>
            )}
          </div>

          {/* 4. CORE NAVIGATION ACTION ROW: Back, Voice Assistant, Home */}
          <div className="grid grid-cols-3 gap-2.5 px-0.5 mb-2.5">
            <button
              type="button"
              onClick={handleBack}
              title="Back"
              className="h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={handleVoice}
              title="Google Assistant Voice Search (Listen)"
              className={`h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm ${
                isListening ? 'ring-2 ring-sky-400 bg-sky-100' : ''
              }`}
            >
              <GoogleAssistantLines size="md" active={isListening} />
            </button>

            <button
              type="button"
              onClick={handleHome}
              title="Home"
              className="h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-700 hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Home className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* 5. VOLUME & SHORTCUTS ROW */}
          <div className="grid grid-cols-4 gap-1.5 px-0.5 mb-2.5">
            {/* Volume Down */}
            <button
              type="button"
              onClick={() => handleVolume(-5)}
              title="Volume Down (-)"
              className="h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-800 text-lg font-bold active:scale-95 cursor-pointer shadow-sm"
            >
              −
            </button>

            {/* Volume Up */}
            <button
              type="button"
              onClick={() => handleVolume(5)}
              title="Volume Up (+)"
              className="h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center text-slate-800 text-lg font-bold active:scale-95 cursor-pointer shadow-sm"
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
              className="h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center gap-1 px-1 active:scale-95 cursor-pointer shadow-sm"
            >
              <div style={{ color: shortcut1.brandColor }} className="shrink-0 flex items-center justify-center">
                <AppIconRenderer iconType={shortcut1.iconType} className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-bold truncate text-slate-800">{shortcut1.shortLabel}</span>
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
              className="h-12 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center gap-1 px-1 active:scale-95 cursor-pointer shadow-sm"
            >
              <div style={{ color: shortcut2.brandColor }} className="shrink-0 flex items-center justify-center">
                <AppIconRenderer iconType={shortcut2.iconType} className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-bold truncate text-slate-800">{shortcut2.shortLabel}</span>
            </button>
          </div>

          {/* 6. CHANNELS TRAY TRIGGER */}
          <div className="w-full px-0.5">
            <button
              type="button"
              onClick={() => setRemoteFace('channels')}
              className="w-full h-10 rounded-2xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 hover:text-black transition-colors cursor-pointer shadow-sm"
            >
              <Grid className="w-4 h-4 text-slate-500" />
              <span>All Channels & Streaming Apps</span>
            </button>
          </div>
        </>
      )}

      {/* FACE 2: CHANNELS & STREAMING APPS VIEW */}
      {remoteFace === 'channels' && (
        <div className="w-full flex flex-col h-[500px] max-h-[75vh] pt-1 pb-1 overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-1 mb-2">
            <button
              type="button"
              onClick={() => setRemoteFace('controls')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D0D5DC] text-xs font-bold text-slate-700 hover:text-black transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Controls</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#E1E5EA] border border-[#D0D5DC] px-2.5 py-1 rounded-full shadow-sm">
              {filteredChannels.length} Channels
            </span>
          </div>

          {/* Channel Search Bar */}
          <div className="relative mb-2 px-1">
            <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={channelSearchQuery}
              onChange={(e) => setChannelSearchQuery(e.target.value)}
              placeholder="Search channels & streaming apps..."
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-white border border-[#D0D5DC] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-sm"
            />
            {channelSearchQuery && (
              <button
                type="button"
                onClick={() => setChannelSearchQuery('')}
                className="absolute right-3.5 top-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Channels Grid with Custom Sleek Scrollbar */}
          <div className="flex-1 min-h-0 overflow-y-auto px-1 pr-1.5 custom-remote-scrollbar space-y-2">
            <div className="grid grid-cols-2 gap-2.5 pb-2">
              {filteredChannels.map((app) => {
                const isKey1 = shortcut1.id === app.id;
                const isKey2 = shortcut2.id === app.id;
                const isHomeKey = isKey1 || isKey2;

                return (
                  <button
                    key={app.id}
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
                    className={`h-14 rounded-2xl border flex items-center gap-3 px-3 relative transition-all cursor-pointer select-none active:scale-95 shadow-sm ${
                      isHomeKey
                        ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400 text-sky-900'
                        : 'bg-[#E1E5EA] hover:bg-[#D8DCE2] border-[#D0D5DC] text-slate-800'
                    }`}
                  >
                    <div style={{ color: app.brandColor }} className="shrink-0 flex items-center justify-center">
                      <AppIconRenderer iconType={app.iconType} className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold truncate text-left">{app.name}</span>

                    {isKey1 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                        1
                      </span>
                    )}
                    {isKey2 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                        2
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {filteredChannels.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Search className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">No channels found</p>
                <button
                  type="button"
                  onClick={() => setChannelSearchQuery('')}
                  className="mt-2 text-xs font-bold text-sky-600 hover:underline cursor-pointer"
                >
                  Reset search
                </button>
              </div>
            )}
          </div>

          {/* Promotion Drawer */}
          {promotingApp && (
            <div className="mt-2 p-3 rounded-2xl bg-[#DFE3E8] border border-[#CFD4DC] shadow-xl flex flex-col items-center text-center shrink-0">
              <span className="text-xs font-bold text-slate-800 mb-1">Assign {promotingApp.name} to:</span>
              <div className="grid grid-cols-2 gap-2 w-full my-2">
                <button
                  type="button"
                  onClick={() => handlePromoteToSlot(1)}
                  className="h-9 rounded-xl bg-white hover:bg-slate-50 border border-[#D0D5DC] text-xs font-semibold text-slate-800 shadow-sm cursor-pointer"
                >
                  Shortcut 1
                </button>
                <button
                  type="button"
                  onClick={() => handlePromoteToSlot(2)}
                  className="h-9 rounded-xl bg-white hover:bg-slate-50 border border-[#D0D5DC] text-xs font-semibold text-slate-800 shadow-sm cursor-pointer"
                >
                  Shortcut 2
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPromotingApp(null)}
                className="text-[11px] text-slate-500 hover:text-slate-800 mt-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
