import React from 'react';
import { Play, Sparkles, ShieldCheck, Zap, Flame, Trophy } from 'lucide-react';
import { soundService } from '../services/soundService.js';
import { telegramSdk } from '../services/telegramSdk.js';

interface StartLaunchScreenProps {
  onStart: () => void;
  onOpenRules?: () => void;
}

export const StartLaunchScreen: React.FC<StartLaunchScreenProps> = ({
  onStart,
  onOpenRules
}) => {
  const handleLaunch = () => {
    soundService.playLineChime();
    telegramSdk.triggerHaptic('heavy');
    onStart();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#080808] text-white p-6 overflow-hidden select-none animate-fadeIn">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#E8FF00]/[0.07] blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-10 inset-x-0 h-48 bg-gradient-to-t from-[#E8FF00]/[0.04] to-transparent pointer-events-none" />

      {/* Top micro pill */}
      <header className="relative z-10 pt-4 flex items-center justify-center w-full">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-arcade tracking-wider uppercase text-white/70 backdrop-blur-md shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#E8FF00] animate-ping" />
          <span className="text-white font-bold">ETHIOPIA'S #1 LIVE BINGO</span>
          <span className="text-white/40">·</span>
          <span className="text-[#E8FF00] font-bold">TELEBIRR</span>
        </div>
      </header>

      {/* Center Hero Game Branding */}
      <main className="relative z-10 flex flex-col items-center text-center max-w-xs w-full space-y-6 my-auto">
        {/* Animated Brand Emblem */}
        <div className="relative group cursor-pointer" onClick={handleLaunch}>
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-b from-[#181818] to-[#0d0d0d] border border-white/15 p-1 flex items-center justify-center shadow-[0_0_35px_rgba(232,255,0,0.25)] group-hover:shadow-[0_0_50px_rgba(232,255,0,0.4)] transition-all duration-300">
            <div className="w-full h-full rounded-[20px] bg-[#121212] border border-[#E8FF00]/40 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Corner tech accents */}
              <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-[#E8FF00]" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-[#E8FF00]" />
              <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l border-[#E8FF00]" />
              <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-[#E8FF00]" />

              <span className="font-arcade text-5xl font-black text-[#E8FF00] tracking-tighter drop-shadow-[0_0_12px_rgba(232,255,0,0.6)]">
                B
              </span>
              <span className="text-[9px] font-arcade font-extrabold uppercase tracking-widest text-white/60 -mt-1">
                75-BALL
              </span>
            </div>
          </div>

          {/* Floating badge */}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#E8FF00] text-black font-arcade font-black text-[10px] tracking-wider uppercase shadow-md flex items-center gap-1 whitespace-nowrap">
            <Zap className="w-3 h-3 fill-current" />
            <span>INSTANT MULTIPLAYER</span>
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="space-y-1.5 pt-2">
          <h1 className="font-arcade text-4xl font-black tracking-tight text-white uppercase">
            BINGO <span className="text-[#E8FF00] drop-shadow-[0_0_16px_rgba(232,255,0,0.5)]">BET</span>
          </h1>
          <p className="font-arcade font-bold text-sm tracking-widest text-[#E8FF00]/90 uppercase">
            PLAY · MATCH · WIN
          </p>
          <p className="text-xs text-white/50 leading-relaxed max-w-[260px] mx-auto pt-1">
            Real-time live pari-mutuel tournament pools. Mark cards, call Bingo & win instant Birr.
          </p>
        </div>

        {/* 3 Quick Benefit Chips */}
        <div className="grid grid-cols-3 gap-2 w-full pt-1">
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <Zap className="w-4 h-4 text-[#E8FF00] mx-auto mb-1" />
            <div className="font-arcade text-[10px] font-bold text-white uppercase">1-Tap</div>
            <div className="text-[9px] text-white/40">Auto-Daub</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <Trophy className="w-4 h-4 text-[#E8FF00] mx-auto mb-1" />
            <div className="font-arcade text-[10px] font-bold text-white uppercase">80%-100%</div>
            <div className="text-[9px] text-white/40">Prize Pool</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 text-center">
            <ShieldCheck className="w-4 h-4 text-[#E8FF00] mx-auto mb-1" />
            <div className="font-arcade text-[10px] font-bold text-white uppercase">SHA-256</div>
            <div className="text-[9px] text-white/40">Fair Draw</div>
          </div>
        </div>
      </main>

      {/* Bottom CTA Area */}
      <footer className="relative z-10 w-full max-w-xs space-y-3 pb-4">
        {/* Chunky Neon Launch Button */}
        <button
          onClick={handleLaunch}
          className="w-full py-4 rounded-2xl bg-[#E8FF00] text-black font-arcade font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(232,255,0,0.5)] active:scale-[0.97] transition-all cursor-pointer hover:bg-[#f0ff2b]"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>START GAME</span>
        </button>

        {/* Secondary link */}
        {onOpenRules && (
          <button
            onClick={() => {
              soundService.playClick();
              onOpenRules();
            }}
            className="w-full py-2 text-center text-xs text-white/50 hover:text-white transition-colors font-arcade font-semibold uppercase tracking-wider cursor-pointer"
          >
            Game Rules & Payout Structure →
          </button>
        )}
      </footer>
    </div>
  );
};
