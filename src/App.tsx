/**
 * Universal White Pebble Remote Application
 * All controls, keys, and indicators are fully embedded INSIDE the remote.
 * Zero external clutter, zero outside buttons, completely seamless.
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleTVRemote } from './components/GoogleTVRemote';
import { MiniRemote } from './components/MiniRemote';
import { DeviceManagerModal } from './components/DeviceManagerModal';
import { TVKeyboardDrawer } from './components/TVKeyboardDrawer';
import { AppShortcut, PRESET_APPS, RemoteTheme } from './types/remote';
import { sound } from './utils/audio';
import { createSpeechRecognizer, parseVoiceCommand } from './utils/speech';
import {
  universalTV,
  SmartTVDevice,
  UniversalCommandLog,
} from './utils/universalTVProtocol';
import { GoogleDots } from './components/BrandIcons';

export default function App() {
  // Always the classic white (Snow) Google TV remote
  const [theme] = useState<RemoteTheme>('snow');

  // Remote Mode: 'full' by default, or 'mini' if toggled or in PiP
  const [remoteMode, setRemoteMode] = useState<'full' | 'mini'>(() => {
    const saved = localStorage.getItem('gtv_remote_mode') as 'full' | 'mini' | null;
    return saved || 'full';
  });

  const [isPip, setIsPip] = useState(false);

  // Listen for native Android Picture-in-Picture mode events
  useEffect(() => {
    const handlePip = (e: any) => {
      const pipActive = Boolean(e.detail?.isPip);
      setIsPip(pipActive);
      if (pipActive) {
        setRemoteMode('mini');
      }
    };
    window.addEventListener('pip-mode-changed', handlePip);
    return () => window.removeEventListener('pip-mode-changed', handlePip);
  }, []);

  const handleEnterFloating = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.enterPip) {
      try {
        (window as any).AndroidNativeBridge.enterPip();
      } catch {
        setRemoteMode('mini');
      }
    } else {
      setRemoteMode('mini');
    }
  };

  // Active connected Smart TV
  const [connectedDevice, setConnectedDevice] = useState<SmartTVDevice | null>(() => {
    return (
      universalTV.getActiveDevice() || {
        id: 'chromecast-living-room',
        name: 'Living Room TV',
        brand: 'google_tv',
        ip: '192.168.1.105',
        port: 6467,
        model: 'Google TV 4K',
        isPaired: true,
        isConnected: true,
        lastPingMs: 24,
      }
    );
  });

  // Customizable Hardware App Shortcut 1 & 2 (Key 1 & Key 2)
  const [shortcut1, setShortcut1] = useState<AppShortcut>(() => {
    const saved = localStorage.getItem('gtv_shortcut_1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return PRESET_APPS[0]; // YouTube
  });

  const [shortcut2, setShortcut2] = useState<AppShortcut>(() => {
    const saved = localStorage.getItem('gtv_shortcut_2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return PRESET_APPS[1]; // Netflix
  });

  // Embedded remote features (TV Pairing & Keyboard input)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [keyboardDrawerOpen, setKeyboardDrawerOpen] = useState(false);

  // Command logs & telemetry
  const [commandLogs, setCommandLogs] = useState<UniversalCommandLog[]>([]);

  // Voice Search State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const speechRecognizerRef = useRef<ReturnType<typeof createSpeechRecognizer> | null>(null);

  // Sync remote mode and update native window bounds
  useEffect(() => {
    localStorage.setItem('gtv_remote_mode', remoteMode);
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.setWindowMode) {
      try {
        (window as any).AndroidNativeBridge.setWindowMode(remoteMode);
      } catch {
        // ignore
      }
    }
  }, [remoteMode]);

  // Subscribe to command transmissions only when Device Manager is open
  useEffect(() => {
    if (!deviceModalOpen) return;
    const unsubscribe = universalTV.onCommand((log) => {
      setCommandLogs((prev) => [log, ...prev].slice(0, 30));
    });
    return unsubscribe;
  }, [deviceModalOpen]);

  // Listen for remote app launch events
  useEffect(() => {
    const handleLaunch = (e: CustomEvent<AppShortcut>) => {
      handleLaunchApp(e.detail);
    };
    window.addEventListener('remote-launch-app' as any, handleLaunch);
    return () => window.removeEventListener('remote-launch-app' as any, handleLaunch);
  }, [connectedDevice]);

  // Save shortcut assignments
  const handleSaveShortcuts = (s1: AppShortcut, s2: AppShortcut) => {
    setShortcut1(s1);
    setShortcut2(s2);
    localStorage.setItem('gtv_shortcut_1', JSON.stringify(s1));
    localStorage.setItem('gtv_shortcut_2', JSON.stringify(s2));
  };

  // Remote keypress handlers (Universal for all smart TVs)
  const handleDpadPress = async (direction: 'up' | 'down' | 'left' | 'right') => {
    const dirMap = {
      up: 'DPAD_UP',
      down: 'DPAD_DOWN',
      left: 'DPAD_LEFT',
      right: 'DPAD_RIGHT',
    } as const;
    await universalTV.sendAction(dirMap[direction]);
  };

  const handleSelectPress = async () => {
    await universalTV.sendAction('SELECT');
  };

  const handleBackPress = async () => {
    await universalTV.sendAction('BACK');
  };

  const handleHomePress = async () => {
    await universalTV.sendAction('HOME');
  };

  const handlePowerPress = async () => {
    await universalTV.sendAction('POWER');
  };

  const handleInputPress = async () => {
    await universalTV.sendAction('TV_INPUT');
  };

  const handleVolumeChange = async (delta: number) => {
    if (delta > 0) {
      await universalTV.sendAction('VOLUME_UP');
    } else {
      await universalTV.sendAction('VOLUME_DOWN');
    }
  };

  const handleMutePress = async () => {
    await universalTV.sendAction('MUTE');
  };

  const handleLaunchApp = async (app: AppShortcut) => {
    sound.playClick('action');
    await universalTV.launchApp(app.id);
  };

  const handleSendText = async (text: string) => {
    await universalTV.sendTextInput(text);
  };

  // Voice Search / Google Assistant
  const handleVoicePress = () => {
    sound.playAssistantChime();
    setIsVoiceActive(true);
    setVoiceTranscript('');

    try {
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.abort();
      }

      const recognizer = createSpeechRecognizer(
        () => {},
        (interim) => {
          setVoiceTranscript(interim);
        },
        async (finalText) => {
          setVoiceTranscript(finalText);
          sound.playAssistantEnd();
          const parsed = parseVoiceCommand(finalText);

          if (parsed.action === 'open_app' && parsed.targetApp) {
            await universalTV.launchApp(parsed.targetApp);
          } else {
            await universalTV.sendVoiceSearch(finalText);
          }

          setTimeout(() => {
            setIsVoiceActive(false);
          }, 1500);
        },
        () => {
          setIsVoiceActive(false);
        },
        () => {}
      );

      if (recognizer) {
        speechRecognizerRef.current = recognizer;
        recognizer.start();
      }
    } catch {
      // fallback
    }
  };


  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleDpadPress('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleDpadPress('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleDpadPress('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleDpadPress('right');
          break;
        case 'Enter':
          e.preventDefault();
          handleSelectPress();
          break;
        case 'Backspace':
        case 'Escape':
          e.preventDefault();
          handleBackPress();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          handleHomePress();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          handleMutePress();
          break;
        case 'v':
        case 'V':
          e.preventDefault();
          handleVoicePress();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleVolumeChange(5);
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleVolumeChange(-5);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="w-full h-full min-h-full flex items-center justify-center p-0 m-0 select-none relative bg-transparent overflow-hidden"
    >
      {/* 
        NO WEBSITE HEADER.
        NO OUTSIDE BUTTONS.
        NO HEAVY BACKGROUND OVERLAYS.
        Only the remote itself captures touches and takes up physical space.
      */}

      {/* Voice Search Floating Toast (Appears over the remote when voice search is active) */}
      {isVoiceActive && (
        <div className="fixed top-8 z-50 pointer-events-auto px-5 py-3 rounded-2xl bg-white/95 text-slate-800 border border-slate-300 shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <GoogleDots className="w-6 h-6" active={true} />
          <div className="text-xs font-semibold">
            {voiceTranscript ? (
              <span className="text-slate-900 font-bold">&ldquo;{voiceTranscript}&rdquo;</span>
            ) : (
              <span className="text-sky-600 animate-pulse">Listening... Speak command</span>
            )}
          </div>
        </div>
      )}

      {/* FULL REMOTE MODE: Only the white remote body appears */}
      {remoteMode === 'full' && (
        <div className="pointer-events-auto">
          <GoogleTVRemote
            theme={theme}
            shortcut1={shortcut1}
            shortcut2={shortcut2}
            onUpdateShortcuts={handleSaveShortcuts}
            onLaunchApp={handleLaunchApp}
            onDpadPress={handleDpadPress}
            onSelectPress={handleSelectPress}
            onBackPress={handleBackPress}
            onHomePress={handleHomePress}
            onVoicePress={handleVoicePress}
            onMutePress={handleMutePress}
            onPowerPress={handlePowerPress}
            onInputPress={handleInputPress}
            onVolumeChange={handleVolumeChange}
            onSwitchToMini={handleEnterFloating}
            onOpenKeyboard={() => setKeyboardDrawerOpen(true)}
            onOpenDeviceManager={() => setDeviceModalOpen(true)}
            isListening={isVoiceActive}
            connectedDevice={connectedDevice}
          />
        </div>
      )}

      {/* 
        MINI REMOTE MODE:
        Nothing on screen except the draggable white mini remote floating in the corner!
      */}
      {remoteMode === 'mini' && (
        <div className="pointer-events-auto">
          <MiniRemote
            isOpen={true}
            theme={theme}
            onExpand={() => setRemoteMode('full')}
            onDpadPress={handleDpadPress}
            onSelectPress={handleSelectPress}
            onBackPress={handleBackPress}
            onHomePress={handleHomePress}
            onVoicePress={handleVoicePress}
            onMutePress={handleMutePress}
            onPowerPress={handlePowerPress}
            onVolumeChange={handleVolumeChange}
            isListening={isVoiceActive}
            isTVOn={true}
          />
        </div>
      )}

      {/* MODALS: Mount on-demand only when opened to keep DOM and memory minimal */}
      {deviceModalOpen && (
        <div className="pointer-events-auto">
          <DeviceManagerModal
            isOpen={true}
            onClose={() => setDeviceModalOpen(false)}
            activeDevice={connectedDevice}
            onDeviceChange={setConnectedDevice}
            commandLogs={commandLogs}
          />
        </div>
      )}

      {keyboardDrawerOpen && (
        <div className="pointer-events-auto">
          <TVKeyboardDrawer
            isOpen={true}
            onClose={() => setKeyboardDrawerOpen(false)}
            onSendText={handleSendText}
          />
        </div>
      )}
    </div>
  );
}
