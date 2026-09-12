import React from 'react';
import { BingoGrid } from '../types/bingo.js';
import { soundService } from '../services/soundService.js';
import { telegramSdk } from '../services/telegramSdk.js';
import { Star, Zap, Flame, Check } from 'lucide-react';

interface BingoCardProps {
  cardId: string;
  grid: BingoGrid;
  cardIndex: number;
  daubedNumbers: Set<number>;
  calledNumbers: Set<number>;
  winningPatternNumbers: Set<number>;
  isWinningCard: boolean;
  autoDaub: boolean;
  onToggleDaub: (num: number) => void;
  isCompact?: boolean;
}

const COL_NAMES: Array<'B' | 'I' | 'N' | 'G' | 'O'> = ['B', 'I', 'N', 'G', 'O'];

const COL_ARCADE = {
  B: { label: 'B', color: '#38bdf8' },
  I: { label: 'I', color: '#a78bfa' },
  N: { label: 'N', color: '#E8FF00' },
  G: { label: 'G', color: '#4ade80' },
  O: { label: 'O', color: '#f43f5e' },
};

export const BingoCard: React.FC<BingoCardProps> = ({
  cardId,
  grid,
  cardIndex,
  daubedNumbers,
  calledNumbers,
  winningPatternNumbers,
  isWinningCard,
  autoDaub,
  onToggleDaub,
  isCompact = false,
}) => {
  // Transpose column-major → row-major 5×5
  const cols = [grid.B, grid.I, grid.N, grid.G, grid.O];
  const matrix: number[][] = [];
  for (let r = 0; r < 5; r++) {
    matrix[r] = [];
    for (let c = 0; c < 5; c++) matrix[r].push(cols[c][r]);
  }

  // Count matches
  let totalMatched = 0;
  for (const col of cols) for (const num of col) if (num === 0 || daubedNumbers.has(num)) totalMatched++;

  // Calculate 1-To-Go / 2-To-Go
  let minToGo = 5;
  for (let r = 0; r < 5; r++) {
    const uncalled = matrix[r].filter(n => n !== 0 && !calledNumbers.has(n)).length;
    if (uncalled < minToGo) minToGo = uncalled;
  }
  for (let c = 0; c < 5; c++) {
    const uncalled = cols[c].filter(n => n !== 0 && !calledNumbers.has(n)).length;
    if (uncalled < minToGo) minToGo = uncalled;
  }
  const diag1 = [matrix[0][0], matrix[1][1], matrix[2][2], matrix[3][3], matrix[4][4]];
  const diag2 = [matrix[0][4], matrix[1][3], matrix[2][2], matrix[3][1], matrix[4][0]];
  const ud1   = diag1.filter(n => n !== 0 && !calledNumbers.has(n)).length;
  const ud2   = diag2.filter(n => n !== 0 && !calledNumbers.has(n)).length;
  minToGo     = Math.min(minToGo, ud1, ud2);

  const isOneToGo = minToGo === 1 && !isWinningCard;
  const isTwoToGo = minToGo === 2 && !isWinningCard;

  const handleCellClick = (num: number) => {
    if (num === 0) return;
    if (calledNumbers.has(num)) {
      soundService.playDaub();
      telegramSdk.triggerHaptic('medium');
      onToggleDaub(num);
    } else {
      soundService.playClick();
      telegramSdk.triggerHaptic('light');
    }
  };

  // Card Outer Glow & Borders
  const cardBorderClass = isWinningCard
    ? 'border-[#E8FF00] shadow-[0_0_35px_rgba(232,255,0,0.5)] bg-[#171a06]'
    : isOneToGo
    ? 'border-[#E8FF00]/60 shadow-[0_0_20px_rgba(232,255,0,0.25)] bg-[#12140a]'
    : 'border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] bg-[#111111]';

  return (
    <div className={`relative rounded-3xl p-3.5 transition-all duration-300 border ${cardBorderClass}`}>
      {/* Card Header Bar */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-arcade text-xs font-black px-2.5 py-0.5 rounded-lg bg-[#E8FF00] text-black shadow-sm uppercase">
            CARD #{cardIndex}
          </span>
          <span className="font-arcade text-[10px] text-white/40 tracking-wider">
            ID: {cardId.slice(-4)}
          </span>
        </div>

        {/* Status Badge */}
        <div>
          {isWinningCard ? (
            <span className="text-xs font-arcade font-black px-3 py-1 rounded-xl flex items-center gap-1.5 bg-[#E8FF00] text-black shadow-[0_0_15px_rgba(232,255,0,0.6)] animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-current" />
              BINGO WINNER!
            </span>
          ) : isOneToGo ? (
            <span className="text-xs font-arcade font-black px-2.5 py-0.5 rounded-xl flex items-center gap-1 bg-[#E8FF00]/20 text-[#E8FF00] border border-[#E8FF00]/50 shadow-[0_0_10px_rgba(232,255,0,0.3)] animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current" />
              1-TO-GO!
            </span>
          ) : isTwoToGo ? (
            <span className="text-[11px] font-arcade font-bold px-2 py-0.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
              2-TO-GO
            </span>
          ) : (
            <div className="flex items-center gap-1 text-xs font-arcade text-white/50">
              <span>DAUBED:</span>
              <span className="font-black text-[#E8FF00]">{totalMatched}/25</span>
            </div>
          )}
        </div>
      </div>

      {/* 5×5 Matrix Outer Box */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-1.5">
        {/* B I N G O Header Row */}
        <div className="grid grid-cols-5 gap-1.5 mb-1.5">
          {COL_NAMES.map((col) => {
            const style = COL_ARCADE[col];
            return (
              <div
                key={col}
                className="py-1.5 rounded-xl text-center bg-[#181818] border border-white/10 flex items-center justify-center shadow-sm"
              >
                <span
                  className="font-arcade font-black text-sm tracking-widest"
                  style={{ color: style.color }}
                >
                  {col}
                </span>
              </div>
            );
          })}
        </div>

        {/* 5 Rows */}
        <div className="grid grid-rows-5 gap-1.5">
          {matrix.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-5 gap-1.5">
              {row.map((num, cIdx) => {
                const isFree   = num === 0;
                const isCalled = isFree || calledNumbers.has(num);
                const isDaubed = isFree || daubedNumbers.has(num);
                const isWinner = isFree || winningPatternNumbers.has(num);

                // Cell theme
                let cellClass = 'bg-[#161616] text-white/90 border border-white/10 hover:border-white/30';

                if (isWinner) {
                  cellClass = 'bg-[#E8FF00] text-black border-2 border-[#E8FF00] shadow-[0_0_20px_rgba(232,255,0,0.8)] scale-[1.03] z-10';
                } else if (isDaubed) {
                  cellClass = 'bg-[#E8FF00] text-black border-2 border-[#E8FF00] shadow-[0_0_12px_rgba(232,255,0,0.4)]';
                } else if (isCalled) {
                  cellClass = 'bg-[#E8FF00]/15 text-[#E8FF00] border-2 border-[#E8FF00]/60 shadow-[0_0_10px_rgba(232,255,0,0.25)] animate-pulse';
                }

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => handleCellClick(num)}
                    disabled={autoDaub && isCalled}
                    className={`relative flex flex-col items-center justify-center rounded-xl transition-all duration-150 select-none ${
                      isCompact ? 'text-xs py-1.5' : 'text-sm py-2'
                    } ${cellClass}`}
                    style={{
                      aspectRatio: '1',
                      cursor: autoDaub && isCalled ? 'default' : 'pointer',
                    }}
                  >
                    {isFree ? (
                      <div className="flex flex-col items-center justify-center">
                        <Star
                          className="w-4 h-4 fill-current"
                          style={{
                            color: isWinner || isDaubed ? '#000000' : '#E8FF00',
                            filter: isWinner || isDaubed ? 'none' : 'drop-shadow(0 0 6px rgba(232,255,0,0.7))',
                          }}
                        />
                        <span
                          className={`text-[8px] font-arcade font-black tracking-tight mt-0.5 ${
                            isWinner || isDaubed ? 'text-black' : 'text-[#E8FF00]'
                          }`}
                        >
                          FREE
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className={`font-arcade font-black leading-none text-base tracking-tight ${
                          isWinner || isDaubed ? 'text-black font-black' : 'text-white'
                        }`}>
                          {num}
                        </span>

                        {/* Stamp Checkmark for marked cells */}
                        {isDaubed && !isWinner && (
                          <div className="absolute top-1 right-1 pointer-events-none">
                            <Check className="w-3 h-3 text-black stroke-[3.5]" />
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
