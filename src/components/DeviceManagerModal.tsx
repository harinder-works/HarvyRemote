import React, { useState } from 'react';
import {
  X,
  Tv,
  CheckCircle2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Terminal,
  Trash2,
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

const DEFAULT_DEVICES: SmartTVDevice[] = [
  {
    id: 'chromecast-living-room',
    name: 'Living Room TV',
    brand: 'google_tv',
    ip: '192.168.1.105',
    port: 6467,
    model: 'Google TV 4K',
    isPaired: true,
    isConnected: true,
    lastPingMs: 24,
  },
  {
    id: 'samsung-qled-bedroom',
    name: 'Bedroom Samsung TV',
    brand: 'samsung',
    ip: '192.168.1.118',
    port: 8002,
    model: 'The Frame 55" (Tizen)',
    isPaired: true,
    isConnected: false,
    lastPingMs: 28,
  },
  {
    id: 'lg-oled-den',
    name: 'Den LG OLED',
    brand: 'lg_webos',
    ip: '192.168.1.142',
    port: 3001,
    model: 'OLED C3 65" (webOS)',
    isPaired: true,
    isConnected: false,
    lastPingMs: 19,
  },
  {
    id: 'tcl-roku-basement',
    name: 'Basement Roku TV',
    brand: 'roku',
    ip: '192.168.1.88',
    port: 8060,
    model: 'Roku TV 50"',
    isPaired: true,
    isConnected: false,
    lastPingMs: 16,
  },
  {
    id: 'fire-tv-guest',
    name: 'Guest Room Fire TV',
    brand: 'fire_tv',
    ip: '192.168.1.164',
    port: 5555,
    model: 'Fire TV Stick 4K Max',
    isPaired: false,
    isConnected: false,
  },
];

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
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return DEFAULT_DEVICES;
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPairDialog, setShowPairDialog] = useState<SmartTVDevice | null>(null);
  const [pairingPin, setPairingPin] = useState('');
  const [activeTab, setActiveTab] = useState<'devices' | 'telemetry'>('devices');

  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceBrand, setNewDeviceBrand] = useState<TVBrand>('samsung');
  const [newDeviceIp, setNewDeviceIp] = useState('');

  if (!isOpen) return null;

  const handleScan = () => {
    setIsScanning(true);
    sound.playClick('button');
    setTimeout(() => {
      setIsScanning(false);
      sound.playAssistantChime();
    }, 1000);
  };

  const handleConnectDevice = (dev: SmartTVDevice) => {
    sound.playClick('action');
    if (!dev.isPaired && TV_BRAND_CONFIG[dev.brand].pairingType === 'pin') {
      setShowPairDialog(dev);
      setPairingPin('');
      return;
    }

    const updated = deviceList.map((d) => ({
      ...d,
      isConnected: d.id === dev.id,
      isPaired: true,
    }));
    saveDevices(updated);
    const target = updated.find((d) => d.id === dev.id) || null;
    onDeviceChange(target);
    universalTV.setActiveDevice(target);
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
      onDeviceChange(null);
      universalTV.setActiveDevice(null);
    }
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPairDialog) return;

    sound.playClick('action');
    const updated = deviceList.map((d) =>
      d.id === showPairDialog.id
        ? { ...d, isPaired: true, isConnected: true }
        : { ...d, isConnected: false }
    );
    saveDevices(updated);
    const target = updated.find((d) => d.id === showPairDialog.id) || null;
    onDeviceChange(target);
    universalTV.setActiveDevice(target);
    setShowPairDialog(null);
    setPairingPin('');
  };

  const handleAddDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim() || !newDeviceIp.trim()) return;

    const brandConfig = TV_BRAND_CONFIG[newDeviceBrand];
    const newDev: SmartTVDevice = {
      id: `tv-${Date.now()}`,
      name: newDeviceName.trim(),
      brand: newDeviceBrand,
      ip: newDeviceIp.trim(),
      port: brandConfig.defaultPort,
      model: brandConfig.osName,
      isPaired: brandConfig.pairingType === 'none',
      isConnected: true,
      lastPingMs: 22,
    };

    const updated = [newDev, ...deviceList.map((d) => ({ ...d, isConnected: false }))];
    saveDevices(updated);
    onDeviceChange(newDev);
    universalTV.setActiveDevice(newDev);
    setShowAddForm(false);
    setNewDeviceName('');
    setNewDeviceIp('');
    sound.playClick('action');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* 
        PEBBLE-SHAPED WHITE REMOTE EXPANDED CONTAINER
        Matches the exact Google TV Remote:
        - Porcelain/Chalk white pebble surface (#EDEDF0)
        - Crisp hairline border (#D9DDE2)
        - Soft multi-layer hardware shadow
      */}
      <div
        className="w-full max-w-[340px] rounded-[52px] bg-[#EDEDF0] border-2 border-[#D9DDE2] remote-shadow overflow-hidden flex flex-col pt-4 pb-6 px-4 relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bezel inside remote */}
        <div className="w-full flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-bold text-slate-600">
            <Tv className="w-3.5 h-3.5 text-sky-600" />
            <span>Connect Smart TV</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-6 h-1.5 rounded-full bg-slate-900/40 border border-black/10" />
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
          </div>

          <button
            onClick={() => {
              sound.playClick('soft');
              onClose();
            }}
            title="Return to Remote"
            className="w-7 h-7 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Selector inside Remote */}
        <div className="grid grid-cols-2 gap-2 px-1 mb-3">
          <button
            onClick={() => setActiveTab('devices')}
            className={`h-9 rounded-full text-xs font-bold transition-all remote-button-shadow border ${
              activeTab === 'devices'
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#E1E5EA] border-[#D3D8E0] text-slate-500 hover:text-slate-800'
            }`}
          >
            TV Devices
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`h-9 rounded-full text-xs font-bold transition-all remote-button-shadow border ${
              activeTab === 'telemetry'
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#E1E5EA] border-[#D3D8E0] text-slate-500 hover:text-slate-800'
            }`}
          >
            Live Logs
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-1 py-1 space-y-2.5 max-h-[380px]">
          {activeTab === 'devices' ? (
            <>
              {/* Scan / Add buttons */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>Select active TV:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleScan}
                    className="font-bold text-sky-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Scan</span>
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="font-bold text-sky-600 hover:underline"
                  >
                    + Add IP
                  </button>
                </div>
              </div>

              {/* Add form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddDeviceSubmit}
                  className="p-3 rounded-2xl bg-[#E1E5EA] border border-[#D3D8E0] space-y-2 text-xs"
                >
                  <input
                    type="text"
                    placeholder="TV Name (e.g. Living Room Bravia)"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-slate-800 text-xs font-medium"
                    required
                  />
                  <input
                    type="text"
                    placeholder="IP Address (e.g. 192.168.1.150)"
                    value={newDeviceIp}
                    onChange={(e) => setNewDeviceIp(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-slate-800 text-xs font-medium"
                    required
                  />
                  <select
                    value={newDeviceBrand}
                    onChange={(e) => setNewDeviceBrand(e.target.value as TVBrand)}
                    className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-slate-800 text-xs font-medium"
                  >
                    <option value="google_tv">Google TV / Android TV</option>
                    <option value="samsung">Samsung Smart TV (Tizen)</option>
                    <option value="lg_webos">LG Smart TV (webOS)</option>
                    <option value="roku">Roku TV / Streaming Stick</option>
                    <option value="fire_tv">Amazon Fire TV</option>
                    <option value="vizio">Vizio SmartCast</option>
                    <option value="universal">Universal Smart TV</option>
                  </select>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-[11px] hover:bg-slate-800 cursor-pointer"
                    >
                      Save TV
                    </button>
                  </div>
                </form>
              )}

              {/* TV Device list */}
              {deviceList.map((dev) => {
                const isCurrent = activeDevice?.id === dev.id;
                const brandMeta = TV_BRAND_CONFIG[dev.brand];
                return (
                  <div
                    key={dev.id}
                    onClick={() => handleConnectDevice(dev)}
                    className={`w-full min-h-[52px] rounded-2xl border remote-button-shadow flex items-center justify-between px-3 text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-white border-sky-400 ring-2 ring-sky-400/40'
                        : 'bg-[#E1E5EA] border-[#D3D8E0] hover:bg-[#D8DCE2]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 py-1.5">
                      <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                        {dev.name}
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {brandMeta.name} · {dev.ip}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 pl-2">
                      {isCurrent ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-semibold hover:text-slate-900">
                          Connect
                        </span>
                      )}

                      {deviceList.length > 1 && (
                        <button
                          type="button"
                          title="Remove TV"
                          onClick={(e) => handleDeleteDevice(e, dev.id)}
                          className="w-6 h-6 rounded-full hover:bg-black/10 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
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
                    className="p-2 rounded-xl bg-white border border-[#D3D8E0] text-slate-700"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-sky-600">{log.command}</span>
                      <span className="text-slate-400">{log.latencyMs}ms</span>
                    </div>
                    <div className="truncate text-slate-500">{log.payload}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom Custom Emblem Logo */}
        <div className="mt-4 pt-2 border-t border-black/5 flex items-center justify-center">
          <WebsiteEmblem className="w-7 h-4.5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
