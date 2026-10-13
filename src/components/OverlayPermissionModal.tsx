import React from 'react';
import { X, Layers, ExternalLink, ShieldCheck, LayoutGrid, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';

interface OverlayPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseInAppMini: () => void;
}

export function OverlayPermissionModal({
  isOpen,
  onClose,
  onUseInAppMini,
}: OverlayPermissionModalProps) {
  if (!isOpen) return null;

  // Open direct toggle for "Display over other apps"
  const handleDirectOverlay = () => {
    sound.playClick('action');
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidNativeBridge : null;
    if (bridge && typeof bridge.requestOverlayPermission === 'function') {
      bridge.requestOverlayPermission();
    }
  };

  // Open the system list of all apps ("Appear on top" / "Display over other apps")
  const handleOpenAppList = () => {
    sound.playClick('action');
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidNativeBridge : null;
    if (bridge && typeof bridge.openOverlaySettingsList === 'function') {
      bridge.openOverlaySettingsList();
    } else if (bridge && typeof bridge.requestOverlayPermission === 'function') {
      bridge.requestOverlayPermission();
    }
  };

  // Open App Details / App Info
  const handleOpenAppInfo = () => {
    sound.playClick('button');
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidNativeBridge : null;
    if (bridge && typeof bridge.openAppDetailsSettings === 'function') {
      bridge.openAppDetailsSettings();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="modal-content relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 text-slate-800 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-inner">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Floating Mini Remote
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Float over WhatsApp, YouTube & other apps
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Content */}
        <div className="py-3.5 space-y-3 text-xs text-slate-600">
          <p className="text-[12px] leading-relaxed">
            To keep all remote buttons <strong className="text-slate-900">clickable</strong> while you browse other apps, Android requires the <strong className="text-slate-900">"Display over other apps"</strong> (or "Appear on top") toggle.
          </p>

          <div className="rounded-2xl bg-sky-50/70 border border-sky-100 p-3 space-y-1.5 text-[11px] text-sky-900">
            <div className="flex items-center gap-1.5 font-bold text-sky-950">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
              <span>How to allow:</span>
            </div>
            <p className="leading-snug text-slate-600">
              Tap <strong className="text-slate-900">"Open Overlay Setting"</strong> below and switch the toggle to <strong className="text-sky-700">Allow</strong> for Harvy Remote.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Primary Action: Direct Overlay Setting */}
          <button
            type="button"
            onClick={handleDirectOverlay}
            className="w-full h-11 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Overlay Setting (1-Tap)</span>
          </button>

          {/* Secondary Action: All Apps List */}
          <button
            type="button"
            onClick={handleOpenAppList}
            className="w-full h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold text-[11.5px] flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
            <span>Find "Harvy Remote" in App List</span>
          </button>

          {/* Fallback Option: In-App Mini Remote without any permission */}
          <button
            type="button"
            onClick={onUseInAppMini}
            className="w-full h-10 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-[0.98] text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all mt-1"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Use In-App Mini Remote (No Permission Needed)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
