import React from 'react';
import {
  Layers,
  ShieldAlert,
  ExternalLink,
  Sliders,
  PictureInPicture2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface FloatingPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterPip: () => void;
  onOpenAppInfo: () => void;
  onOpenOverlaySettings: () => void;
}

export function FloatingPermissionModal({
  isOpen,
  onClose,
  onEnterPip,
  onOpenAppInfo,
  onOpenOverlaySettings,
}: FloatingPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#161B26] border border-slate-700/80 rounded-3xl shadow-2xl p-5 text-white flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Floating Remote Setup</h3>
              <p className="text-[11px] text-slate-400">Keep remote on screen while using other apps</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.playClick('soft');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Why Setting is Disabled Note */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex gap-3 text-amber-200 text-xs leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-amber-300">Why does it not allow enabling?</span>
            <span className="text-[11.5px] text-amber-200/90">
              On Android 13 & 14, manually installed apps have sensitive settings locked for security (&quot;Restricted setting&quot;). You must allow restricted settings first before enabling overlay.
            </span>
          </div>
        </div>

        {/* Option A: Quick 2-Step Unlock for Floating Overlay */}
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>Method 1: Persistent Floating Overlay</span>
          </div>

          {/* Step 1 */}
          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div className="flex flex-col text-xs text-slate-300">
                <span className="font-bold text-white">Unlock Restricted Settings</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Tap below to open App Info. Then tap the <strong>three dots (⋮)</strong> in the top-right corner and select <strong>&quot;Allow restricted settings&quot;</strong>.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playClick('action');
                onOpenAppInfo();
              }}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Step 1: Open App Info (Tap 3 Dots ⋮)</span>
            </button>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div className="flex flex-col text-xs text-slate-300">
                <span className="font-bold text-white">Turn On &quot;Display over other apps&quot;</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Now open overlay settings, select <strong>HarvyRemote</strong>, and toggle <strong>&quot;Allow display over other apps&quot;</strong> to ON.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playClick('action');
                onOpenOverlaySettings();
              }}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Step 2: Open &quot;Display Over Other Apps&quot;</span>
            </button>
          </div>
        </div>

        {/* Option B: Picture-in-Picture (No Permissions Needed!) */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2.5 text-emerald-200">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <PictureInPicture2 className="w-4 h-4" />
            <span>Method 2: Picture-in-Picture (No Setup Required!)</span>
          </div>
          <p className="text-[11.5px] text-emerald-200/90 leading-relaxed">
            Want to use it right now without changing system settings? Picture-in-Picture floats the remote immediately over your wallpaper and other apps.
          </p>
          <button
            type="button"
            onClick={() => {
              sound.playClick('action');
              onEnterPip();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Float Now via Picture-in-Picture</span>
          </button>
        </div>

        {/* Footer / Cancel */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              sound.playClick('soft');
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
          >
            Use Full Remote in App
          </button>
        </div>
      </div>
    </div>
  );
}
