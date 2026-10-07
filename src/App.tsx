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
  const [isAppClosed, setIsAppClosed] = useState(false);
  const [hasOverlayPermission, setHasOverlayPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.hasOverlayPermission) {
      try {
        return Boolean((window as any).AndroidNativeBridge.hasOverlayPermission());
      } catch {
        return true;
      }
    }
    return true;
  });

  const handleCloseApp = () => {
    sound.playClick('soft');
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.closeApp) {
      try {
        (window as any).AndroidNativeBridge.closeApp();
        return;
      } catch {}
    }
    if (typeof window !== 'undefined' && (window as any).NativeTVManager?.closeApp) {
      try {
        (window as any).NativeTVManager.closeApp();
        return;
      } catch {}
    }
    if (window.opener) {
      window.close();
    } else {
      setIsAppClosed(true);
    }
  };

  // Listen for native Android Picture-in-Picture & Overlay permission events
  useEffect(() => {
    const handlePip = (e: any) => {
      const pipActive = Boolean(e.detail?.isPip);
      setIsPip(pipActive);
      if (pipActive) {
        setRemoteMode('mini');
      } else {
        setRemoteMode('full');
      }
    };

    const handleOverlayStatus = (e: any) => {
      if (typeof e.detail?.granted === 'boolean') {
        setHasOverlayPermission(e.detail.granted);
        if (e.detail.granted) {
          handleEnterFloating();
        }
      }
    };

    window.addEventListener('pip-mode-changed', handlePip);
    window.addEventListener('overlay-permission-status', handleOverlayStatus);
    return () => {
      window.removeEventListener('pip-mode-changed', handlePip);
      window.removeEventListener('overlay-permission-status', handleOverlayStatus);
    };
  }, []);

  const handleEnterFloating = () => {
    sound.playClick('action');
    setRemoteMode('mini');
    setIsPip(false);
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.hasOverlayPermission) {
      const hasPerm = (window as any).AndroidNativeBridge.hasOverlayPermission();
      if (!hasPerm) {
        setHasOverlayPermission(false);
        (window as any).AndroidNativeBridge.requestOverlayPermission();
        return;
      }
    }
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.startFloatingRemote) {
      try {
        (window as any).AndroidNativeBridge.startFloatingRemote();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleExitFloating = () => {
    sound.playClick('action');
    setRemoteMode('full');
    setIsPip(false);
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.hideFloatingRemote) {
      try {
        (window as any).AndroidNativeBridge.hideFloatingRemote();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Active connected Smart TV
  const [connectedDevice, setConnectedDevice] = useState<SmartTVDevice | null>(() => {
    const active = universalTV.getActiveDevice();
    if (active) return active;
    try {
      const saved = localStorage.getItem('saved_smart_tv_devices');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) {
          universalTV.setActiveDevice(list[0]);
          return list[0];
        }
      }
    } catch {
      // ignore
    }
    return null;
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

  // Installed TV apps (synced from TV and persisted)
  const [installedApps, setInstalledApps] = useState<AppShortcut[]>(() => {
    try {
      const saved = localStorage.getItem('gtv_installed_apps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return PRESET_APPS;
  });

  const [isSyncingApps, setIsSyncingApps] = useState(false);

  // Sync apps listener from UniversalTVClient / NativeTVManager
  useEffect(() => {
    const unsubscribe = universalTV.onInstalledApps((apps) => {
      if (Array.isArray(apps) && apps.length > 0) {
        const normalized: AppShortcut[] = apps.map((a: any) => {
          const id = a.id || a.appId || a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const existing = PRESET_APPS.find((p) => p.id === id);
          return {
            id,
            name: a.name || id,
            shortLabel: a.shortLabel || a.name || id,
            iconType: (a.iconType || existing?.iconType || 'custom') as any,
            brandColor: a.brandColor || existing?.brandColor || '#38bdf8',
            textColor: a.textColor || '#FFFFFF',
            category: a.category || existing?.category || 'Streaming',
            tagline: a.tagline || existing?.tagline || `Launch ${a.name || id} on TV`,
            heroColor: a.heroColor || existing?.heroColor || 'from-slate-900 via-slate-950 to-black',
          };
        });

        setInstalledApps(normalized);
        setIsSyncingApps(false);
        try {
          localStorage.setItem('gtv_installed_apps', JSON.stringify(normalized));
        } catch {}
      }
    });

    return unsubscribe;
  }, []);

  // Auto-fetch TV apps when connected device is available & sync with floating remote
  useEffect(() => {
    if (connectedDevice?.ip) {
      universalTV.fetchInstalledApps(connectedDevice.brand, connectedDevice.ip, connectedDevice.port);
      if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.updateFloatingDeviceInfo) {
        try {
          (window as any).AndroidNativeBridge.updateFloatingDeviceInfo(
            connectedDevice.brand,
            connectedDevice.ip,
            connectedDevice.port,
            connectedDevice.name
          );
        } catch {}
      }
    }
  }, [connectedDevice]);

  const handleSyncApps = () => {
    setIsSyncingApps(true);
    sound.playClick('action');
    universalTV.fetchInstalledApps();
    setTimeout(() => setIsSyncingApps(false), 3000);
  };

  const handleAddCustomApp = (newApp: AppShortcut) => {
    sound.playClick('button');
    setInstalledApps((prev) => {
      const updated = [newApp, ...prev.filter((a) => a.id !== newApp.id)];
      try {
        localStorage.setItem('gtv_installed_apps', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDeleteApp = (appId: string) => {
    sound.playClick('soft');
    setInstalledApps((prev) => {
      const updated = prev.filter((a) => a.id !== appId);
      try {
        localStorage.setItem('gtv_installed_apps', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

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
    <div className="w-full min-h-screen select-none bg-gradient-to-b from-[#0B0F19] via-[#090D16] to-[#05070D] overflow-hidden flex items-center justify-center">
      {/* Voice Search Floating Toast */}
      {isVoiceActive && !isAppClosed && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto px-5 py-3 rounded-2xl bg-white/95 text-slate-800 border border-slate-300 shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-3">
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

      {/* Floating Restore Button (Only if user closed remote in web preview) */}
      {isAppClosed && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              sound.playClick('action');
              setIsAppClosed(false);
            }}
            className="px-4 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white shadow-2xl border border-white/20 backdrop-blur-md text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Open Google TV Remote</span>
          </button>
        </div>
      )}

      {/* FULL REMOTE MODE: All controls are embedded cleanly inside the remote pebble */}
      {remoteMode === 'full' && !isAppClosed && (
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
          onCloseApp={handleCloseApp}
          isListening={isVoiceActive}
          connectedDevice={connectedDevice}
          installedApps={installedApps}
          onSyncApps={handleSyncApps}
          onAddCustomApp={handleAddCustomApp}
          onDeleteApp={handleDeleteApp}
          isSyncingApps={isSyncingApps}
        />
      )}

      {/* MINI REMOTE MODE: Ultra-sleek compact widget */}
      {remoteMode === 'mini' && !isAppClosed && (
        <MiniRemote
          isOpen={true}
          theme={theme}
          isPip={false}
          onExpand={handleExitFloating}
          onDpadPress={handleDpadPress}
          onSelectPress={handleSelectPress}
          onBackPress={handleBackPress}
          onHomePress={handleHomePress}
          onVoicePress={handleVoicePress}
          onMutePress={handleMutePress}
          onPowerPress={handlePowerPress}
          onVolumeChange={handleVolumeChange}
          onCloseApp={handleCloseApp}
          isListening={isVoiceActive}
          isTVOn={true}
          connectedDevice={connectedDevice}
        />
      )}

      {/* MODALS */}
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
