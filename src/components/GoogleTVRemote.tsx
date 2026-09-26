import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { AppShortcut, PRESET_APPS, RemoteTheme } from '../types/remote';
import { AppIconRenderer, GoogleDots, WebsiteEmblem } from './BrandIcons';
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

  // Hardware LED state & active button depression animation
  const [ledActive, setLedActive] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);

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

  const triggerLed = (buttonId?: string) => {
    if (buttonId) {
      setActiveButton(buttonId);
      setTimeout(() => setActiveButton(null), 180);
    }
    setLedActive(true);
    setTimeout(() => setLedActive(false), 220);
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
  const handlePointerDown = (e: React.PointerEvent) => {
    setTouchStartPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
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
    <div className="relative select-none flex items-center justify-center">
      {/* Remote Outer Casing Container with Side Volume Rocker */}
      <div className="relative flex items-center justify-center py-2 px-6">
        
        {/* PHYSICAL HARDWARE: Right Edge Volume Rocker */}
        <div className="absolute right-2 top-48 z-20 flex flex-col items-center">
          <div className="w-4 h-32 rounded-r-xl bg-gradient-to-r from-black/20 via-black/10 to-transparent flex flex-col justify-between py-1 shadow-md">
            {/* Volume Up */}
            <button
              type="button"
              title="Volume Up (+)"
              onClick={() => handleVolume(5)}
              className={`w-4 h-14 rounded-r-lg ${styles.sideRocker} border-y border-r flex items-center justify-center transition-all cursor-pointer ${
                activeButton === 'vol-up' ? 'scale-95 brightness-90 translate-x-[-1px]' : 'hover:brightness-95'
              }`}
            >
              <span className="text-[12px] font-bold leading-none select-none pl-0.5 text-slate-700">+</span>
            </button>

            {/* Separator */}
            <div className="w-2.5 h-px bg-black/20 self-center" />

            {/* Volume Down */}
            <button
              type="button"
              title="Volume Down (-)"
              onClick={() => handleVolume(-5)}
              className={`w-4 h-14 rounded-r-lg ${styles.sideRocker} border-y border-r flex items-center justify-center transition-all cursor-pointer ${
                activeButton === 'vol-down' ? 'scale-95 brightness-90 translate-x-[-1px]' : 'hover:brightness-95'
              }`}
            >
              <span className="text-[14px] font-bold leading-none select-none pl-0.5 text-slate-700">−</span>
            </button>
          </div>
        </div>

        {/* Remote Pebble Body (ALL CONTROLS FULLY EMBEDDED INSIDE) */}
        <div
          className={`w-[196px] rounded-[60px] ${styles.body} border-2 remote-shadow transition-colors duration-300 relative flex flex-col items-center pt-3 pb-6 px-4`}
          style={{ minHeight: '488px' }}
        >
          {/* TOP BEZEL INSIDE REMOTE: TV Status, IR LED, and Mode/Mini Switch */}
          <div className="w-full flex items-center justify-between px-1 mb-2.5">
            {/* TV Device Connection Pill (Inside remote) */}
            <button
              onClick={onOpenDeviceManager}
              title={connectedDevice ? `Connected to ${connectedDevice.name} (${connectedDevice.ip})` : 'Select / Pair Smart TV'}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 hover:bg-black/10 text-[10px] font-bold text-slate-600 transition-colors"
            >
              <span
                className={`w-1.5 h-1.5 shrink-0 rounded-full ${
                  connectedDevice ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="truncate max-w-[82px]">
                {connectedDevice ? connectedDevice.name : 'Connect TV'}
              </span>
            </button>

            {/* Center IR Transceiver & Activity LED */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-1.5 rounded-full bg-slate-900/40 border border-black/10" />
              <div
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-pulse scale-125'
                    : ledActive
                    ? styles.accentLed
                    : 'bg-black/15'
                }`}
              />
            </div>

            {/* Face Switch or Mini Remote Button */}
            {remoteFace === 'channels' ? (
              <button
                onClick={() => {
                  sound.playClick('button');
                  setRemoteFace('controls');
                }}
                title="Return to D-Pad Controls"
                className="w-6 h-6 rounded-full bg-black/5 hover:bg-black/10 text-slate-600 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  sound.playClick('action');
                  onSwitchToMini();
                }}
                title="Switch to Draggable Mini Remote"
                className="p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-black/10 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ON-REMOTE TOAST / STATUS FEEDBACK (Embedded cleanly inside the remote) */}
          {onRemoteStatus && (
            <div className="w-full mb-2 px-2 py-1 rounded-full bg-sky-500 text-white text-[9px] font-bold text-center shadow-md animate-in fade-in zoom-in duration-150 truncate">
              {onRemoteStatus}
            </div>
          )}

          {/* ========================================================= */}
          {/* FACE 1: STANDARD REMOTE CONTROLS (D-Pad, Voice, Home...) */}
          {/* ========================================================= */}
          {remoteFace === 'controls' && (
            <>
              {/* D-PAD / TRACKPAD AREA */}
              {controlMode === 'dpad' ? (
                /* Directional Ring */
                <div className="relative w-[138px] h-[138px] mb-3 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full ${styles.dpadRing} border-2 dpad-groove`}>
                    {/* Up */}
                    <button
                      type="button"
                      onClick={() => handleDpad('up')}
                      className={`absolute top-0 left-0 right-0 h-11 flex items-center justify-center pt-1.5 cursor-pointer text-slate-600 transition-all ${
                        activeButton === 'dpad-up' ? 'scale-90 opacity-70' : 'hover:opacity-80 active:scale-95'
                      }`}
                      title="Navigate Up"
                    >
                      <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    {/* Down */}
                    <button
                      type="button"
                      onClick={() => handleDpad('down')}
                      className={`absolute bottom-0 left-0 right-0 h-11 flex items-center justify-center pb-1.5 cursor-pointer text-slate-600 transition-all ${
                        activeButton === 'dpad-down' ? 'scale-90 opacity-70' : 'hover:opacity-80 active:scale-95'
                      }`}
                      title="Navigate Down"
                    >
                      <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    {/* Left */}
                    <button
                      type="button"
                      onClick={() => handleDpad('left')}
                      className={`absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pl-1.5 cursor-pointer text-slate-600 transition-all ${
                        activeButton === 'dpad-left' ? 'scale-90 opacity-70' : 'hover:opacity-80 active:scale-95'
                      }`}
                      title="Navigate Left"
                    >
                      <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    {/* Right */}
                    <button
                      type="button"
                      onClick={() => handleDpad('right')}
                      className={`absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pr-1.5 cursor-pointer text-slate-600 transition-all ${
                        activeButton === 'dpad-right' ? 'scale-90 opacity-70' : 'hover:opacity-80 active:scale-95'
                      }`}
                      title="Navigate Right"
                    >
                      <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Center Select (OK) */}
                  <button
                    type="button"
                    onClick={handleSelect}
                    title="Select / OK"
                    className={`relative z-10 w-[58px] h-[58px] rounded-full ${styles.dpadCenter} border-2 remote-button-shadow cursor-pointer transition-all flex items-center justify-center ${
                      activeButton === 'dpad-select' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-black/10 border border-white/20" />
                  </button>
                </div>
              ) : (
                /* Swipe Trackpad Area */
                <div
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  className={`w-[138px] h-[138px] rounded-3xl ${styles.dpadRing} border-2 dpad-groove mb-3 flex flex-col items-center justify-center text-center p-3 cursor-pointer touch-none active:brightness-95 transition-all`}
                >
                  <MousePointer className="w-5 h-5 text-sky-500 mb-1 opacity-80" />
                  <span className="text-[10px] font-semibold text-slate-600">
                    Swipe to Navigate
                  </span>
                  <span className="text-[9px] text-slate-400">Tap to Select</span>
                </div>
              )}

              {/* BUTTON GRID: Row 1 - Back & Voice Search */}
              <div className="grid grid-cols-2 gap-2.5 w-full px-1 mb-2.5">
                {/* Back Button */}
                <button
                  type="button"
                  onClick={handleBack}
                  title="Back"
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer ${
                    activeButton === 'back' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
                </button>

                {/* Google Assistant Voice Search Button */}
                <button
                  type="button"
                  onClick={handleVoice}
                  title="Voice Search"
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer relative overflow-hidden ${
                    isListening ? 'ring-2 ring-sky-400 bg-sky-100/60' : ''
                  } ${
                    activeButton === 'voice' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <GoogleDots className="w-5 h-5" active={isListening} />
                </button>
              </div>

              {/* BUTTON GRID: Row 2 - Home & Mute */}
              <div className="grid grid-cols-2 gap-2.5 w-full px-1 mb-2.5">
                {/* Home Button */}
                <button
                  type="button"
                  onClick={handleHome}
                  title="Home"
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer ${
                    activeButton === 'home' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <Home className="w-4 h-4 stroke-[2.2]" />
                </button>

                {/* Mute Button */}
                <button
                  type="button"
                  onClick={handleMute}
                  title="Mute Audio"
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer ${
                    activeButton === 'mute' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <VolumeX className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>

              {/* BUTTON GRID: Row 3 - Customizable App Shortcut Buttons (Key 1 & Key 2) */}
              <div className="grid grid-cols-2 gap-2.5 w-full px-1 mb-2.5">
                {/* Shortcut 1 */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick('action');
                    triggerLed('app-1');
                    onLaunchApp(shortcut1);
                    showStatus(`Playing ${shortcut1.shortLabel}`);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    sound.playClick('button');
                    setPromotingApp(shortcut1);
                    setRemoteFace('channels');
                  }}
                  title={`${shortcut1.name} (Hold or right-click to change)`}
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center gap-1.5 px-2.5 transition-all cursor-pointer ${
                    activeButton === 'app-1' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <div style={{ color: shortcut1.brandColor }} className="shrink-0 flex items-center justify-center">
                    <AppIconRenderer iconType={shortcut1.iconType} className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight truncate max-w-[48px] text-slate-700">
                    {shortcut1.shortLabel}
                  </span>
                </button>

                {/* Shortcut 2 */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick('action');
                    triggerLed('app-2');
                    onLaunchApp(shortcut2);
                    showStatus(`Playing ${shortcut2.shortLabel}`);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    sound.playClick('button');
                    setPromotingApp(shortcut2);
                    setRemoteFace('channels');
                  }}
                  title={`${shortcut2.name} (Hold or right-click to change)`}
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center gap-1.5 px-2.5 transition-all cursor-pointer ${
                    activeButton === 'app-2' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <div style={{ color: shortcut2.brandColor }} className="shrink-0 flex items-center justify-center">
                    <AppIconRenderer iconType={shortcut2.iconType} className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold tracking-tight truncate max-w-[48px] text-slate-700">
                    {shortcut2.shortLabel}
                  </span>
                </button>
              </div>

              {/* BUTTON GRID: Row 4 - Power & TV Input */}
              <div className="grid grid-cols-2 gap-2.5 w-full px-1 mb-2.5">
                {/* Power Button */}
                <button
                  type="button"
                  onClick={handlePower}
                  title="TV Power"
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer text-emerald-600 ${
                    activeButton === 'power' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <Power className="w-4 h-4 stroke-[2.2]" />
                </button>

                {/* Input Button */}
                <button
                  type="button"
                  onClick={handleInput}
                  title="TV Input Source"
                  className={`h-11 rounded-full ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer text-slate-700 ${
                    activeButton === 'input' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <Tv className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>

              {/* BUTTON GRID: Row 5 - CLEAN ICON-ONLY HARDWARE ROW (Keyboard & Channels Grid) */}
              <div className="grid grid-cols-2 gap-2.5 w-full px-1 mb-2">
                {/* On-Screen Keyboard Trigger (Icon Only) */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick('button');
                    triggerLed('keyboard');
                    onOpenKeyboard();
                  }}
                  title="Keyboard Typing for TV"
                  className={`h-10 rounded-2xl ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer text-slate-600 hover:text-slate-900 ${
                    activeButton === 'keyboard' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                </button>

                {/* All Channels Grid Face Trigger (Icon Only) */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick('button');
                    triggerLed('apps');
                    setRemoteFace('channels');
                  }}
                  title="All Channels & Apps (Hotstar, Netflix, YouTube, Prime, Disney+...)"
                  className={`h-10 rounded-2xl ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer text-slate-600 hover:text-slate-900 ${
                    activeButton === 'apps' ? 'remote-button-pressed' : 'hover:brightness-95 active:scale-95'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ============================================================== */}
          {/* FACE 2: CHANNELS LIST (EXACT SAME REMOTE CASING & BUTTON KEYS) */}
          {/* ============================================================== */}
          {remoteFace === 'channels' && (
            <div className="w-full flex-1 flex flex-col items-center">
              {/* Header Label inside Remote */}
              <div className="w-full flex items-center justify-center px-1 mb-2.5">
                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-slate-400" />
                  Channels
                </span>
              </div>

              {/* Channels Grid: EXACT tactile icon buttons matching remote keys */}
              <div
                className="w-full flex-1 overflow-y-auto px-1 py-1 space-y-2 max-h-[300px] scrollbar-thin"
                style={{ scrollbarWidth: 'none' }}
              >
                <div className="grid grid-cols-2 gap-2 w-full">
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
                        title={`${app.name} (${isHomeKey ? 'Promoted to Home Screen • ' : ''}Tap to play, Hold to set Home key)`}
                        className={`h-12 rounded-full border remote-button-shadow flex items-center justify-center relative transition-all cursor-pointer select-none active:scale-90 ${
                          isHomeKey
                            ? 'bg-[#EBF3FE] border-sky-400 ring-2 ring-sky-400/40 shadow-sm'
                            : `${styles.button} border-[#D3D8E0]`
                        } ${activeButton === `ch-${app.id}` ? 'remote-button-pressed' : ''}`}
                      >
                        {/* Official Crisp Brand Icon */}
                        <div
                          style={{ color: app.brandColor }}
                          className="shrink-0 flex items-center justify-center scale-110"
                        >
                          <AppIconRenderer iconType={app.iconType} className="w-5 h-5" />
                        </div>

                        {/* Distinct Promoted Home Screen Indicator Badge */}
                        {isKey1 && (
                          <span
                            title="Assigned to Left Home Key"
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white text-[8px] font-black flex items-center justify-center shadow-sm ring-1 ring-white"
                          >
                            1
                          </span>
                        )}
                        {isKey2 && (
                          <span
                            title="Assigned to Right Home Key"
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white text-[8px] font-black flex items-center justify-center shadow-sm ring-1 ring-white"
                          >
                            2
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Navigation Row on Channels Face */}
              <div className="grid grid-cols-2 gap-2.5 w-full px-1 mt-3 mb-1">
                {/* Back to D-Pad Remote Controls */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick('button');
                    setRemoteFace('controls');
                  }}
                  title="Back to D-Pad Controls"
                  className={`h-10 rounded-2xl ${styles.button} border remote-button-shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer text-slate-700 font-bold text-[10px]`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>D-Pad</span>
                </button>

                {/* Keyboard typing button */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick('button');
                    onOpenKeyboard();
                  }}
                  title="Open TV Keyboard"
                  className={`h-10 rounded-2xl ${styles.button} border remote-button-shadow flex items-center justify-center transition-all cursor-pointer text-slate-600 hover:text-slate-900`}
                >
                  <Keyboard className="w-4 h-4" />
                </button>
              </div>

              {/* INLINE PROMOTION DRAWER / MODAL INSIDE THE REMOTE */}
              {promotingApp && (
                <div className="absolute inset-x-3 bottom-12 z-30 rounded-[32px] bg-[#E1E5EA] border-2 border-slate-300 shadow-2xl p-3 flex flex-col items-center text-center animate-in slide-in-from-bottom-2 duration-150">
                  <div
                    className="w-8 h-8 rounded-full bg-white remote-button-shadow flex items-center justify-center mb-1.5"
                    style={{ color: promotingApp.brandColor }}
                  >
                    <AppIconRenderer iconType={promotingApp.iconType} className="w-4 h-4" />
                  </div>

                  <span className="text-[10px] font-bold text-slate-800 mb-0.5 truncate max-w-[140px]">
                    {promotingApp.name}
                  </span>
                  <span className="text-[9px] text-slate-500 mb-2">
                    Set as Home Screen Button:
                  </span>

                  <div className="grid grid-cols-2 gap-1.5 w-full mb-2">
                    <button
                      type="button"
                      onClick={() => handlePromoteToSlot(1)}
                      className={`h-8 rounded-full border text-[9px] font-bold remote-button-shadow transition-all ${
                        shortcut1.id === promotingApp.id
                          ? 'bg-sky-500 text-white border-sky-600'
                          : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 active:scale-95'
                      }`}
                    >
                      Key 1 ({shortcut1.shortLabel})
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePromoteToSlot(2)}
                      className={`h-8 rounded-full border text-[9px] font-bold remote-button-shadow transition-all ${
                        shortcut2.id === promotingApp.id
                          ? 'bg-sky-500 text-white border-sky-600'
                          : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 active:scale-95'
                      }`}
                    >
                      Key 2 ({shortcut2.shortLabel})
                    </button>
                  </div>

                  {(shortcut1.id === promotingApp.id || shortcut2.id === promotingApp.id) && (
                    <button
                      type="button"
                      onClick={() => handleDemoteSlot(shortcut1.id === promotingApp.id ? 1 : 2)}
                      className="text-[9px] font-semibold text-rose-600 hover:text-rose-700 mb-1"
                    >
                      Demote from Home Screen
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPromotingApp(null)}
                    className="text-[9px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bottom Custom Emblem Logo */}
          <div className="mt-auto pt-1 flex items-center justify-center">
            <WebsiteEmblem className={`w-7 h-4.5 ${styles.logo}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
