import React from 'react';
import {
  Maximize2,
  GripHorizontal,
  ArrowLeft,
  Home,
  VolumeX,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Power,
} from 'lucide-react';
import { GoogleDots } from './BrandIcons';
import { sound } from '../utils/audio';
import { RemoteTheme } from '../types/remote';

interface MiniRemoteProps {
  isOpen: boolean;
  theme: RemoteTheme;
  onExpand: () => void;
  onDpadPress: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelectPress: () => void;
  onBackPress: () => void;
  onHomePress: () => void;
  onVoicePress: () => void;
  onMutePress: () => void;
  onPowerPress: () => void;
  onVolumeChange: (delta: number) => void;
  isListening: boolean;
  isTVOn: boolean;
}

export function MiniRemote({
  isOpen,
  onExpand,
  onDpadPress,
  onSelectPress,
  onBackPress,
  onHomePress,
  onVoicePress,
  onMutePress,
  onPowerPress,
  onVolumeChange,
  isListening,
}: MiniRemoteProps) {
  if (!isOpen) return null;

  // Pure White Google TV Pebble styling centered perfectly in PiP frame
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-1 select-none overflow-hidden bg-transparent">
      <div
        className="w-[158px] max-w-[96vw] rounded-[32px] border-2 border-[#D9DDE2] bg-[#EDEDF0] text-slate-800 p-2 select-none remote-shadow flex flex-col items-center shrink-0 my-auto"
      >
        {/* Top Controls (Power & Expand) */}
        <div className="w-full flex items-center justify-between pb-1 mb-1 border-b border-black/10 select-none">
          <div className="flex items-center gap-1 pl-1 py-0.5">
            <GripHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Google TV</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Power Button */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('action');
                onPowerPress();
              }}
              title="TV Power"
              className="p-1 rounded-full hover:bg-black/10 text-emerald-600 transition-colors active:scale-90"
            >
              <Power className="w-3 h-3" />
            </button>

            {/* Expand to Full Remote Button */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('action');
                onExpand();
              }}
              title="Expand to Full Remote"
              className="p-1 rounded-full hover:bg-black/10 text-sky-600 transition-colors active:scale-90"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Mini D-Pad */}
        <div className="relative w-[104px] h-[104px] mx-auto my-0.5 flex items-center justify-center">
          {/* Directional Pad Ring */}
          <div className="absolute inset-0 rounded-full bg-[#DFE3E8] border border-[#CFD4DC] dpad-groove">
            {/* Up */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('dpad');
                onDpadPress('up');
              }}
              title="Up"
              className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center pt-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            {/* Down */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('dpad');
                onDpadPress('down');
              }}
              title="Down"
              className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center pb-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {/* Left */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('dpad');
                onDpadPress('left');
              }}
              title="Left"
              className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center pl-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {/* Right */}
            <button
              type="button"
              onClick={() => {
                sound.playClick('dpad');
                onDpadPress('right');
              }}
              title="Right"
              className="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-center pr-0.5 text-slate-600 hover:text-black active:scale-90 transition-transform"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center OK */}
          <button
            type="button"
            onClick={() => {
              sound.playClick('action');
              onSelectPress();
            }}
            title="Select / OK"
            className="relative z-10 w-9 h-9 rounded-full bg-[#EAEEF3] border border-[#D5DAE2] remote-button-shadow active:scale-90 transition-transform flex items-center justify-center text-[10px] font-bold text-slate-700"
          >
            OK
          </button>
        </div>

        {/* Row 1: Back, Voice Assistant, Home */}
        <div className="grid grid-cols-3 gap-1 w-full my-0.5">
          <button
            type="button"
            onClick={() => {
              sound.playClick('button');
              onBackPress();
            }}
            title="Back"
            className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all text-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onVoicePress}
            title="Voice Search"
            className={`h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all ${
              isListening ? 'ring-2 ring-sky-400 bg-sky-100' : ''
            }`}
          >
            <GoogleDots className="w-3.5 h-3.5" active={isListening} />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick('button');
              onHomePress();
            }}
            title="Home"
            className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 transition-all text-slate-700"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2: Volume Controls & Mute */}
        <div className="grid grid-cols-3 gap-1 w-full my-0.5">
          <button
            type="button"
            onClick={() => {
              sound.playClick('dpad');
              onVolumeChange(-5);
            }}
            title="Volume Down"
            className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-xs font-bold text-slate-700"
          >
            −
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick('button');
              onMutePress();
            }}
            title="Mute"
            className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-slate-700"
          >
            <VolumeX className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick('dpad');
              onVolumeChange(5);
            }}
            title="Volume Up"
            className="h-7 rounded-xl bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center active:scale-95 text-xs font-bold text-slate-700"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
