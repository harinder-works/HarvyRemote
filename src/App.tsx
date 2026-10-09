/**
 * Universal White Pebble Remote Application
 * All controls, keys, and indicators are fully embedded INSIDE the remote.
 * Zero external clutter, zero outside buttons, completely seamless.
 */

import React, { useState, useEffect } from 'react';
import { GoogleTVRemote } from './components/GoogleTVRemote';
import { MiniRemote } from './components/MiniRemote';
import { DeviceManagerModal } from './components/DeviceManagerModal';
import { AppShortcut, RemoteTheme } from './types/remote';
import { sound } from './utils/audio';
import {
  universalTV,
  SmartTVDevice,
  UniversalCommandLog,
} from './utils/universalTVProtocol';

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

  // Listen for native Android Picture-in-Picture events
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

    window.addEventListener('pip-mode-changed', handlePip);
    return () => {
      window.removeEventListener('pip-mode-changed', handlePip);
    };
  }, []);

  // Enter Mini / Floating remote
  const handleEnterMini = () => {
    sound.playClick('action');
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.startFloatingRemote) {
      try {
        (window as any).AndroidNativeBridge.startFloatingRemote();
      } catch (e) {
        console.error('Android startFloatingRemote error:', e);
      }
    }
    setRemoteMode('mini');
  };

  // Exit Mini / Floating remote and expand to Full Remote
  const handleExitMini = () => {
    sound.playClick('action');
    if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.hideFloatingRemote) {
      try {
        (window as any).AndroidNativeBridge.hideFloatingRemote();
      } catch (e) {
        console.error('Android hideFloatingRemote error:', e);
      }
    }
    setRemoteMode('full');
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

  // Embedded remote features (TV Pairing Modal)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);

  // Command logs & telemetry
  const [commandLogs, setCommandLogs] = useState<UniversalCommandLog[]>([]);

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

  // Auto-fetch TV apps when connected device is available & sync with floating remote
  useEffect(() => {
    if (connectedDevice?.ip) {
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

  const handleUsbPress = async () => {
    sound.playClick('action');
    await universalTV.sendAction('USB_MEDIA');
    const bridge = (window as any).NativeTVManager;
    if (bridge && typeof bridge.openUsbMedia === 'function') {
      try {
        bridge.openUsbMedia();
      } catch (e) {
        console.error('Bridge USB media error:', e);
      }
    }
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
        case ' ':
          e.preventDefault();
          handleSelectPress();
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          handleBackPress();
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
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.remote-draggable-container') && !target.closest('button')) {
          if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.moveTaskToBack) {
            try {
              (window as any).AndroidNativeBridge.moveTaskToBack();
            } catch {}
          }
        }
      }}
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.remote-draggable-container') && !target.closest('button')) {
          if (typeof window !== 'undefined' && (window as any).AndroidNativeBridge?.moveTaskToBack) {
            try {
              (window as any).AndroidNativeBridge.moveTaskToBack();
            } catch {}
          }
        }
      }}
      className="relative w-full min-h-screen select-none bg-transparent overflow-hidden flex items-center justify-center"
    >
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
          onLaunchApp={handleLaunchApp}
          onDpadPress={handleDpadPress}
          onSelectPress={handleSelectPress}
          onBackPress={handleBackPress}
          onHomePress={handleHomePress}
          onMutePress={handleMutePress}
          onPowerPress={handlePowerPress}
          onInputPress={handleInputPress}
          onUsbPress={handleUsbPress}
          onVolumeChange={handleVolumeChange}
          onSwitchToMini={handleEnterMini}
          onOpenDeviceManager={() => setDeviceModalOpen(true)}
          onCloseApp={handleCloseApp}
          connectedDevice={connectedDevice}
        />
      )}

      {/* MINI REMOTE MODE */}
      {remoteMode === 'mini' && !isAppClosed && (
        <MiniRemote
          isOpen={true}
          theme={theme}
          onExpand={handleExitMini}
          onSelectPress={handleSelectPress}
          onPowerPress={handlePowerPress}
          onMutePress={handleMutePress}
          onVolumeChange={handleVolumeChange}
          onCloseApp={handleCloseApp}
          connectedDevice={connectedDevice}
        />
      )}

      {/* MODALS */}
      {deviceModalOpen && (
        <div className="relative z-50 pointer-events-auto">
          <DeviceManagerModal
            isOpen={true}
            onClose={() => setDeviceModalOpen(false)}
            activeDevice={connectedDevice}
            onDeviceChange={setConnectedDevice}
            commandLogs={commandLogs}
          />
        </div>
      )}
    </div>
  );
}
