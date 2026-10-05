import React, { useState } from 'react';
import { X, Send, Keyboard, CornerDownLeft } from 'lucide-react';
import { sound } from '../utils/audio';
import { WebsiteEmblem } from './BrandIcons';

interface TVKeyboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSendText: (text: string) => void;
}

export function TVKeyboardDrawer({ isOpen, onClose, onSendText }: TVKeyboardDrawerProps) {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sound.playClick('action');
    onSendText(inputText);
    setInputText('');
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
        className="w-full max-w-[340px] rounded-[52px] bg-[#EDEDF0] border-2 border-[#D9DDE2] remote-shadow overflow-hidden flex flex-col pt-4 pb-6 px-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bezel inside remote */}
        <div className="w-full flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-bold text-slate-600">
            <Keyboard className="w-3.5 h-3.5 text-sky-600" />
            <span>Type on TV</span>
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

        <p className="text-[11px] text-slate-500 px-2 mb-3">
          Type search terms or passwords to send directly to your TV:
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 px-1">
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Type text for TV..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full pl-4 pr-8 py-2.5 bg-[#E1E5EA] border border-[#D3D8E0] rounded-full text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 text-xs font-medium"
            />
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick presets (tactile pills matching remote buttons) */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {['Hotstar', 'YouTube', 'Netflix', 'Cricket', 'Action'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  sound.playClick('button');
                  setInputText(preset);
                }}
                className="px-2.5 py-1 bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow text-[10px] font-bold text-slate-700 rounded-full active:scale-95 transition-all"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-full h-11 rounded-full bg-[#E1E5EA] hover:bg-[#D8DCE2] border border-[#D3D8E0] remote-button-shadow flex items-center justify-center gap-1.5 text-xs font-bold text-slate-800 disabled:opacity-50 active:scale-95 transition-all"
            >
              <span>Send to TV</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-2 border-t border-black/5 flex items-center justify-center">
          <WebsiteEmblem className="w-7 h-4.5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
