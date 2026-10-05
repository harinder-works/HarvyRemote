import React, { useState, useEffect } from 'react';
import {
  X,
  Tv,
  CheckCircle2,
  Check,
  RefreshCw,
  Plus,
  ShieldCheck,
  Terminal,
  Trash2,
  Wifi,
  Radio,
  AlertCircle,
} from 'lucide-react';
import {
  SmartTVDevice,
  TVBrand,
  TV_BRAND_CONFIG,
  universalTV,
  UniversalCommandLog,
} from '../utils/universalTVProtocol';
import { sound } from '../utils/audio';
import { WebsiteEmblem } from './BrandIcons';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: SmartTVDevice | null;
  onDeviceChange: (device: SmartTVDevice | null) => void;
  commandLogs: UniversalCommandLog[];
}

export function DeviceManagerModal({
  isOpen,
  onClose,
  activeDevice,
  onDeviceChange,
  commandLogs,
}: DeviceManagerModalProps) {
  const [deviceList, setDeviceList] = useState<SmartTVDevice[]>(() => {
    try {
      const saved = localStorage.getItem('saved_smart_tv_devices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const saveDevices = (list: SmartTVDevice[]) => {
    setDeviceList(list);
    try {
      localStorage.setItem('saved_smart_tv_devices', JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPairDialog, setShowPairDialog] = useState<SmartTVDevice | null>(null);
  const [pairingPin, setPairingPin] = useState('');
  const [pairingState, setPairingState] = useState<'idle' | 'starting' | 'waiting_code' | 'verifying' | 'success' | 'error'>('idle');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'devices' | 'telemetry'>('devices');

  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceBrand, setNewDeviceBrand] = useState<TVBrand>('google_tv');
  const [newDeviceIp, setNewDeviceIp] = useState('');
  const [newDevicePort, setNewDevicePort] = useState('6467');

  // Listen for real-time discovered Smart TVs from NativeTVManager
  useEffect(() => {
    const unsubDiscovered = universalTV.onDeviceDiscovered((dev: SmartTVDevice) => {
      setDeviceList((prev) => {
        const existingIdx = prev.findIndex((d) => d.ip === dev.ip || d.id === dev.id);
        let updated: SmartTVDevice[];
        if (existingIdx >= 0) {
          updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            name: dev.name || updated[existingIdx].name,
            model: dev.model || updated[existingIdx].model,
            brand: dev.brand || updated[existingIdx].brand,
            port: dev.port || updated[existingIdx].port,
            lastPingMs: dev.lastPingMs || updated[existingIdx].lastPingMs,
            isPaired: updated[existingIdx].isPaired || dev.isPaired,
          };
        } else {
          updated = [dev, ...prev];
        }

        try {
          localStorage.setItem('saved_smart_tv_devices', JSON.stringify(updated));
        } catch {
          // ignore
        }

        // Auto-connect if no TV was previously active
        if (!activeDevice) {
          onDeviceChange(dev);
          universalTV.setActiveDevice(dev);
        }

        return updated;
      });

      sound.playClick('action');
    });

    const unsubFinished = universalTV.onScanFinished((count: number, subnet: string) => {
      setIsScanning(false);
      sound.playAssistantChime();
      if (count > 0) {
        setScanMessage(`Found ${count} Smart TV${count > 1 ? 's' : ''} on Wi-Fi (${subnet}x)`);
      } else {
        setScanMessage(`Scan finished on ${subnet}x. If your TV wasn't detected, add its IP below.`);
      }
    });

    const unsubPing = universalTV.onPingResult((ip: string, isConnected: boolean, latencyMs: number) => {
      setDeviceList((prev) =>
        prev.map((d) =>
          d.ip === ip ? { ...d, isConnected, lastPingMs: latencyMs } : d
        )
      );
    });

    const unsubPairCode = universalTV.onPairingCodeRequested(({ ip }) => {
      const existing = deviceList.find((d) => d.ip === ip);
      if (existing?.isPaired) {
        return;
      }
      setPairingState('waiting_code');
      setPairingError(null);
      // Auto-open pairing modal if not already open
      setShowPairDialog((current) => {
        if (current && current.ip === ip) return current;
        return existing || {
          id: `tv-${ip.replace(/\./g, '-')}`,
          name: 'Google TV',
          brand: 'google_tv',
          ip,
          port: 6467,
          isPaired: false,
          isConnected: false,
        };
      });
    });

    const unsubPairStatus = universalTV.onPairStatus(({ success, ip, message }) => {
      if (success) {
        setPairingState('success');
        setPairingError(null);
        sound.playAssistantChime();
        setDeviceList((prev) => {
          const updated = prev.map((d) =>
            d.ip === ip ? { ...d, isPaired: true, isConnected: true } : d
          );
          saveDevices(updated);
          const target = updated.find((d) => d.ip === ip) || null;
          if (target) {
            onDeviceChange(target);
            universalTV.setActiveDevice(target);
          }
          return updated;
        });
        setTimeout(() => {
          setShowPairDialog(null);
          setPairingState('idle');
          setPairingPin('');
        }, 1200);
      } else {
        setPairingState('error');
        setPairingError(message || 'Pairing rejected. Please check code.');
        sound.playClick('soft');
      }
    });

    return () => {
      unsubDiscovered();
      unsubFinished();
      unsubPing();
      unsubPairCode();
      unsubPairStatus();
    };
  }, [activeDevice, deviceList, onDeviceChange]);

  // Update default port when brand changes in manual add form
  useEffect(() => {
    const defaultP = TV_BRAND_CONFIG[newDeviceBrand]?.defaultPort || 6467;
    setNewDevicePort(String(defaultP));
  }, [newDeviceBrand]);

  if (!isOpen) return null;

  const handleScan = () => {
    setIsScanning(true);
    setScanMessage('Scanning local Wi-Fi network for Smart TVs...');
    sound.playClick('button');
    universalTV.startScan();

    // Safety timeout in case scan finish event isn't returned
    setTimeout(() => {
      setIsScanning((scanning) => {
        if (scanning) {
          return false;
        }
        return false;
      });
    }, 6000);
  };

  const triggerPairing = (dev: SmartTVDevice) => {
    setShowPairDialog(dev);
    setPairingPin('');
    setPairingState('starting');
    setPairingError(null);
    universalTV.startPairing(dev.ip);
  };

  const handleConnectDirectWithoutPin = (targetDevice: SmartTVDevice) => {
    sound.playClick('action');
    const updated = deviceList.map((d) => ({
      ...d,
      isPaired: d.id === targetDevice.id ? true : d.isPaired,
      isConnected: d.id === targetDevice.id,
    }));
    saveDevices(updated);
    const savedDev = { ...targetDevice, isPaired: true, isConnected: true };
    onDeviceChange(savedDev);
    universalTV.setActiveDevice(savedDev);
    setShowPairDialog(null);
    setPairingState('idle');
    setPairingPin('');
    setPairingError(null);
  };

  const handleConnectDevice = (dev: SmartTVDevice) => {
    sound.playClick('action');
    if (!dev.isPaired && TV_BRAND_CONFIG[dev.brand]?.pairingType === 'pin') {
      triggerPairing(dev);
      return;
    }

    const updated = deviceList.map((d) => ({
      ...d,
      isConnected: d.id === dev.id,
      isPaired: d.id === dev.id ? true : d.isPaired,
    }));
    saveDevices(updated);
    const target = updated.find((d) => d.id === dev.id) || null;
    onDeviceChange(target);
    universalTV.setActiveDevice(target);

    // Test ping
    universalTV.pingDevice(dev.ip, dev.port);
  };

  const handleDisconnect = () => {
    sound.playClick('soft');
    const updated = deviceList.map((d) => ({ ...d, isConnected: false }));
    saveDevices(updated);
    onDeviceChange(null);
    universalTV.setActiveDevice(null);
  };

  const handleDeleteDevice = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    sound.playClick('soft');
    const updated = deviceList.filter((d) => d.id !== id);
    saveDevices(updated);
    if (activeDevice?.id === id) {
      const nextActive = updated[0] || null;
      onDeviceChange(nextActive);
      universalTV.setActiveDevice(nextActive);
    }
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPairDialog) return;
    const cleanPin = pairingPin.trim().toUpperCase();
    if (cleanPin.length !== 6) {
      setPairingError('Enter the 6-character code shown on your TV screen');
      return;
    }

    sound.playClick('action');
    setPairingState('verifying');
    setPairingError(null);
    universalTV.submitPairingPin(showPairDialog.ip, cleanPin);
  };

  const handleAddDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIp = newDeviceIp.trim();
    if (!newDeviceName.trim() || !cleanIp) return;

    const brandConfig = TV_BRAND_CONFIG[newDeviceBrand];
    const parsedPort = parseInt(newDevicePort, 10) || brandConfig.defaultPort;
    const requiresPinPairing = brandConfig.pairingType === 'pin';

    const newDev: SmartTVDevice = {
      id: `tv-${cleanIp.replace(/\./g, '-')}`,
      name: newDeviceName.trim(),
      brand: newDeviceBrand,
      ip: cleanIp,
      port: parsedPort,
      model: brandConfig.osName,
      isPaired: !requiresPinPairing,
      isConnected: !requiresPinPairing,
      lastPingMs: 16,
    };

    const updated = [newDev, ...deviceList.filter((d) => d.ip !== cleanIp).map((d) => ({ ...d, isConnected: false }))];
    saveDevices(updated);

    setShowAddForm(false);
    setNewDeviceName('');
    setNewDeviceIp('');
    sound.playClick('action');

    if (requiresPinPairing) {
      triggerPairing(newDev);
    } else {
      onDeviceChange(newDev);
      universalTV.setActiveDevice(newDev);
      universalTV.pingDevice(cleanIp, parsedPort);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[350px] rounded-[44px] bg-[#EDEDF0] border-2 border-[#D9DDE2] remote-shadow overflow-hidden flex flex-col pt-4 pb-5 px-4 relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bezel inside remote */}
        <div className="w-full flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 text-[11px] font-bold text-slate-700">
            <Tv className="w-3.5 h-3.5 text-sky-600" />
            <span>Smart TV Setup</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-6 h-1.5 rounded-full bg-slate-900/30 border border-black/10" />
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>

          <button
            onClick={() => {
              sound.playClick('soft');
              onClose();
            }}
            title="Return to Remote"
            className="w-7 h-7 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-2 px-1 mb-2.5">
          <button
            onClick={() => setActiveTab('devices')}
            className={`h-8 rounded-full text-xs font-bold transition-all remote-button-shadow border cursor-pointer ${
              activeTab === 'devices'
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#E1E5EA] border-[#D3D8E0] text-slate-500 hover:text-slate-800'
            }`}
          >
            TV Devices ({deviceList.length})
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`h-8 rounded-full text-xs font-bold transition-all remote-button-shadow border cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#E1E5EA] border-[#D3D8E0] text-slate-500 hover:text-slate-800'
            }`}
          >
            Live Logs
          </button>
        </div>

        {/* Scan & Add Top Bar */}
        <div className="flex items-center justify-between px-1 mb-2 text-xs">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Wi-Fi...' : 'Auto-Scan Network'}</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-2.5 py-1.5 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>Add IP</span>
          </button>
        </div>

        {/* Scan Status Notice */}
        {scanMessage && (
          <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-800 flex items-start gap-1.5 leading-snug">
            <Radio className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
            <span className="flex-1">{scanMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-1 py-1 space-y-2 max-h-[360px] custom-scrollbar">
          {activeTab === 'devices' ? (
            <>
              {/* Manual Add Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddDeviceSubmit}
                  className="p-3 rounded-2xl bg-white border border-[#D3D8E0] space-y-2 text-xs shadow-sm mb-2"
                >
                  <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                    <span>Add TV by IP Address</span>
                    <span className="text-[10px] text-slate-500 font-normal">Direct Connection</span>
                  </div>

                  <input
                    type="text"
                    placeholder="TV Name (e.g. Living Room Google TV)"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#F5F6F8] rounded-xl border border-slate-300 text-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                    required
                  />

                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="text"
                      placeholder="IP (e.g. 192.168.1.50)"
                      value={newDeviceIp}
                      onChange={(e) => setNewDeviceIp(e.target.value)}
                      className="col-span-2 px-2.5 py-1.5 bg-[#F5F6F8] rounded-xl border border-slate-300 text-slate-800 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Port"
                      value={newDevicePort}
                      onChange={(e) => setNewDevicePort(e.target.value)}
                      className="col-span-1 px-2 py-1.5 bg-[#F5F6F8] rounded-xl border border-slate-300 text-slate-800 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <select
                    value={newDeviceBrand}
                    onChange={(e) => setNewDeviceBrand(e.target.value as TVBrand)}
                    className="w-full px-2 py-1.5 bg-[#F5F6F8] rounded-xl border border-slate-300 text-slate-800 text-xs font-medium cursor-pointer"
                  >
                    <option value="google_tv">Google TV / Android TV (6467)</option>
                    <option value="roku">Roku TV / Streaming Stick (8060)</option>
                    <option value="samsung">Samsung Smart TV Tizen (8002)</option>
                    <option value="lg_webos">LG webOS Smart TV (3001)</option>
                    <option value="fire_tv">Amazon Fire TV (5555)</option>
                    <option value="vizio">Vizio SmartCast (7345)</option>
                    <option value="universal">Universal Smart TV (DIAL 8008)</option>
                  </select>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-2.5 py-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-xl bg-slate-900 text-white font-bold text-[11px] hover:bg-slate-800 cursor-pointer shadow-sm"
                    >
                      Connect TV
                    </button>
                  </div>
                </form>
              )}

              {/* Empty state if no TVs found yet */}
              {deviceList.length === 0 && !showAddForm && (
                <div className="p-5 rounded-2xl bg-[#E1E5EA] border border-[#D3D8E0] text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white mx-auto flex items-center justify-center text-sky-600 shadow-sm">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">No TVs Added Yet</div>
                  <div className="text-[11px] text-slate-600 leading-relaxed px-2">
                    Make sure your phone and TV are connected to the same Wi-Fi network, then tap <strong>Auto-Scan</strong>.
                  </div>
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="mt-2 px-4 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Auto-Scan Network</span>
                  </button>
                </div>
              )}

              {/* TV Device list */}
              {deviceList.map((dev) => {
                const isCurrent = activeDevice?.id === dev.id || activeDevice?.ip === dev.ip;
                const brandMeta = TV_BRAND_CONFIG[dev.brand] || TV_BRAND_CONFIG.google_tv;
                return (
                  <div
                    key={dev.id}
                    onClick={() => handleConnectDevice(dev)}
                    className={`w-full min-h-[54px] rounded-2xl border remote-button-shadow flex items-center justify-between px-3 text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-white border-sky-400 ring-2 ring-sky-400/30'
                        : 'bg-[#E1E5EA] border-[#D3D8E0] hover:bg-[#D8DCE2]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 py-1.5 pr-2">
                      <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                        <span className="truncate">{dev.name}</span>
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {brandMeta.name} · {dev.ip}:{dev.port}
                      </div>
                      {dev.model && (
                        <div className="text-[9px] text-slate-400 truncate">
                          {dev.model}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 pl-1">
                      {!dev.isPaired && TV_BRAND_CONFIG[dev.brand]?.pairingType === 'pin' ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerPairing(dev);
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>Pair</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectDirectWithoutPin(dev);
                            }}
                            title="Connect without PIN"
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs cursor-pointer"
                          >
                            Direct
                          </button>
                        </div>
                      ) : isCurrent ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConnectDevice(dev);
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 hover:bg-white text-slate-700 border border-slate-300 shadow-xs cursor-pointer"
                        >
                          Select
                        </button>
                      )}

                      <button
                        type="button"
                        title="Remove TV"
                        onClick={(e) => handleDeleteDevice(e, dev.id)}
                        className="w-6 h-6 rounded-full hover:bg-black/10 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* Telemetry Live Log */
            <div className="space-y-1.5 text-[10px] font-mono">
              {commandLogs.length === 0 ? (
                <div className="p-4 text-center text-slate-500 bg-[#E1E5EA] rounded-xl border border-[#D3D8E0]">
                  Press any remote key to see live transmission logs.
                </div>
              ) : (
                commandLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-xl bg-white border border-[#D3D8E0] text-slate-700 shadow-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-sky-600 font-sans">{log.command}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                        log.status === 'ack' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {log.status === 'ack' ? `${log.latencyMs}ms OK` : 'FAILED'}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 truncate mt-0.5">{log.wireProtocol}</div>
                    <div className="truncate text-slate-500 font-mono text-[9px]">{log.payload}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Active TV Status Footer */}
        <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between px-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`w-1.5 h-1.5 rounded-full ${activeDevice ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span className="truncate">
              {activeDevice ? `${activeDevice.name} (${activeDevice.ip})` : 'No TV Selected'}
            </span>
          </div>
          <WebsiteEmblem className="w-6 h-4 text-slate-400 shrink-0" />
        </div>

        {/* Google TV / PIN Pairing Modal Dialog */}
        {showPairDialog && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm rounded-[44px] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-[310px] bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 text-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 mx-auto flex items-center justify-center shadow-inner">
                {pairingState === 'verifying' || pairingState === 'starting' ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
                ) : pairingState === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-sky-600" />
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {pairingState === 'success' ? 'Connected!' : `Pair with ${showPairDialog.name}`}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {pairingState === 'starting'
                    ? 'Connecting to TV on Wi-Fi...'
                    : pairingState === 'verifying'
                    ? 'Authenticating code with TV...'
                    : pairingState === 'success'
                    ? 'Paired and ready to control!'
                    : 'Look at your TV screen. Enter the 6-character code shown on screen.'}
                </p>
              </div>

              {pairingState !== 'success' && (
                <form onSubmit={handlePairSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="e.g. 7A4B12"
                      value={pairingPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 6);
                        setPairingPin(val);
                        if (val.length === 6 && pairingState !== 'verifying') {
                          setPairingState('verifying');
                          setPairingError(null);
                          universalTV.submitPairingPin(showPairDialog.ip, val);
                        }
                      }}
                      className="w-full h-12 text-center text-lg font-mono font-bold tracking-[0.35em] uppercase rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:outline-none bg-slate-50 text-slate-900 transition-all shadow-inner"
                    />
                  </div>

                  {pairingError && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 text-left">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                        <div>
                          <div className="font-bold">{pairingError}</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                            TV must be powered ON and on the same Wi-Fi. If your TV does not display a code or rejected pairing, you can connect directly.
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => triggerPairing(showPairDialog)}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry Pairing</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConnectDirectWithoutPin(showPairDialog)}
                          className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Connect Directly</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPairDialog(null);
                        setPairingState('idle');
                        setPairingPin('');
                      }}
                      className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={pairingPin.length !== 6 || pairingState === 'verifying'}
                      className="flex-1 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      {pairingState === 'verifying' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>Pair TV</span>
                      )}
                    </button>
                  </div>

                  {/* Option to skip PIN pairing directly */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleConnectDirectWithoutPin(showPairDialog)}
                      className="text-[10px] text-sky-600 hover:text-sky-700 hover:underline font-medium transition-colors cursor-pointer"
                    >
                      Skip PIN & Connect Directly via Wi-Fi &rarr;
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
