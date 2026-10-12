import React from 'react';
import { X, Layers, ExternalLink, HelpCircle, Smartphone } from 'lucide-react';
import { sound } from '../utils/audio';

interface OverlayPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsePip: () => void;
}

export function OverlayPermissionModal({
  isOpen,
  onClose,
  onUsePip,
}: OverlayPermissionModalProps) {
  if (!isOpen) return null;

  const handleOpenSettings = () => {
    sound.playClick('action');
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidNativeBridge : null;
    if (bridge) {
      if (typeof bridge.openAppDetailsSettings === 'function') {
        bridge.openAppDetailsSettings();
      } else if (typeof bridge.requestOverlayPermission === 'function') {
        bridge.requestOverlayPermission();
      }
    }
  };

  const handleDirectOverlayRequest = () => {
    sound.playClick('button');
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidNativeBridge : null;
    if (bridge && typeof bridge.requestOverlayPermission === 'function') {
      bridge.requestOverlayPermission();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="modal-content relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 text-slate-800 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Enable Floating Remote
              </h3>
              <p className="text-[11px] text-slate-500">
                Control TV over WhatsApp & other apps
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
        <div className="py-4 space-y-3.5 text-xs text-slate-600">
          <p className="text-[11.5px] leading-relaxed">
            To keep all remote buttons <strong className="text-slate-800">100% clickable</strong> while using other apps, Android requires the <strong className="text-slate-800">"Display over other apps"</strong> permission.
          </p>

          {/* Android 13/14 Restricted Settings Guide */}
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11.5px]">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>If it says "Restricted setting":</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-950/80 pl-0.5 leading-normal">
              <li>Tap <strong className="text-amber-900">Open App Info</strong> below</li>
              <li>Tap the <strong className="text-amber-900">3 dots (⋮)</strong> in the top-right corner</li>
              <li>Select <strong className="text-amber-900">Allow restricted settings</strong> & enter PIN</li>
              <li>Then turn on <strong className="text-amber-900">Display over other apps</strong></li>
            </ol>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="w-full h-11 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open App Info (Tap 3 Dots)</span>
          </button>

          <button
            type="button"
            onClick={handleDirectOverlayRequest}
            className="w-full h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Open "Display Over Other Apps" directly</span>
          </button>

          <button
            type="button"
            onClick={onUsePip}
            className="w-full h-9 rounded-2xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-600 font-semibold text-[11px] flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>Or use Picture-in-Picture mode</span>
          </button>
        </div>
      </div>
    </div>
  );
}
