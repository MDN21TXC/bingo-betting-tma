import { BingoGrid } from '../types/bingo.js';

export interface WinningPatternResult {
  hasWon: boolean;
  patterns: Record<string, number[]>;
  patternTypes: {
    hasFullHouse: boolean;
    hasLine: boolean;
    hasCorners: boolean;
  };
  matchedNumbersCount: number;
}

export function verifyWinningPatterns(grid: BingoGrid, calledBalls: number[]): WinningPatternResult {
  const calledSet = new Set(calledBalls);
  calledSet.add(0); // Center free cell

  const cols = [grid.B, grid.I, grid.N, grid.G, grid.O];
  const matrix: number[][] = [];
  for (let r = 0; r < 5; r++) {
    matrix[r] = [];
    for (let c = 0; c < 5; c++) {
      matrix[r].push(cols[c][r]);
    }
  }

  const winningPatterns: Record<string, number[]> = {};

  // 1. Check Rows
  for (let r = 0; r < 5; r++) {
    if (matrix[r].every(num => calledSet.has(num))) {
      winningPatterns[`Row ${r + 1}`] = matrix[r];
    }
  }

  // 2. Check Columns
  const colNames = ['B', 'I', 'N', 'G', 'O'];
  for (let c = 0; c < 5; c++) {
    if (cols[c].every(num => calledSet.has(num))) {
      winningPatterns[`Column ${colNames[c]}`] = cols[c];
    }
  }

  // 3. Check Diagonals
  const diag1 = [matrix[0][0], matrix[1][1], matrix[2][2], matrix[3][3], matrix[4][4]];
  if (diag1.every(num => calledSet.has(num))) {
    winningPatterns['Diagonal TL-BR'] = diag1;
  }

  const diag2 = [matrix[0][4], matrix[1][3], matrix[2][2], matrix[3][1], matrix[4][0]];
  if (diag2.every(num => calledSet.has(num))) {
    winningPatterns['Diagonal BL-TR'] = diag2;
  }

  // 4. Check Four Corners
  const corners = [matrix[0][0], matrix[0][4], matrix[4][0], matrix[4][4]];
  if (corners.every(num => calledSet.has(num))) {
    winningPatterns['Four Corners'] = corners;
  }

  // 5. Full House (Blackout)
  const flatAll = cols.flat();
  if (flatAll.every(num => calledSet.has(num))) {
    winningPatterns['Full House'] = flatAll;
  }

  const patternKeys = Object.keys(winningPatterns);
  const hasFullHouse = Boolean(winningPatterns['Full House']);
  const hasCorners = Boolean(winningPatterns['Four Corners']);
  const hasLine = patternKeys.some(k => k.startsWith('Row') || k.startsWith('Column') || k.startsWith('Diagonal'));

  let matchedCount = 0;
  for (const col of cols) {
    for (const num of col) {
      if (calledSet.has(num)) matchedCount++;
    }
  }

  return {
    hasWon: patternKeys.length > 0,
    patterns: winningPatterns,
    patternTypes: {
      hasFullHouse,
      hasLine,
      hasCorners
    },
    matchedNumbersCount: matchedCount
  };
}
