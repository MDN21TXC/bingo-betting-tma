import { describe, it, expect } from 'vitest';
import {
  generate75BallCard,
  generateCardCatalog,
  generateShuffledBalls,
  verifyWinningPatterns,
  computeCommitmentHash,
  computeTicketFingerprint,
  calculatePariMutuelPool,
  BingoGrid
} from './BingoEngine.js';

describe('BingoEngine Unit Tests (GLI-11 Compliance & Blueprint)', () => {
  it('generates a valid 75-Ball Bingo Card within numeric column bands and sorted vertically', () => {
    const card = generate75BallCard();

    // Check columns existence
    expect(card.B).toHaveLength(5);
    expect(card.I).toHaveLength(5);
    expect(card.N).toHaveLength(5);
    expect(card.G).toHaveLength(5);
    expect(card.O).toHaveLength(5);

    // Check intervals
    card.B.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(15);
    });
    card.I.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(16);
      expect(n).toBeLessThanOrEqual(30);
    });
    // N column has 0 at index 2 (FREE space)
    expect(card.N[2]).toBe(0);
    [card.N[0], card.N[1], card.N[3], card.N[4]].forEach(n => {
      expect(n).toBeGreaterThanOrEqual(31);
      expect(n).toBeLessThanOrEqual(45);
    });
    card.G.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(46);
      expect(n).toBeLessThanOrEqual(60);
    });
    card.O.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(61);
      expect(n).toBeLessThanOrEqual(75);
    });

    // Check vertical sorting (excluding the center free 0 for N)
    const isSorted = (arr: number[]) => arr.every((v, i, a) => !i || a[i - 1] <= v);
    expect(isSorted(card.B)).toBe(true);
    expect(isSorted(card.I)).toBe(true);
    expect(isSorted(card.G)).toBe(true);
    expect(isSorted(card.O)).toBe(true);
    expect(card.N[0] < card.N[1]).toBe(true);
    expect(card.N[3] < card.N[4]).toBe(true);
  });

  it('generates a cryptographically shuffled 75-ball array with exact range 1-75 and no duplicates', () => {
    const balls = generateShuffledBalls();
    expect(balls).toHaveLength(75);

    const set = new Set(balls);
    expect(set.size).toBe(75);

    balls.forEach(ball => {
      expect(ball).toBeGreaterThanOrEqual(1);
      expect(ball).toBeLessThanOrEqual(75);
    });
  });

  it('verifies Horizontal Row win patterns correctly', () => {
    const mockCard: BingoGrid = {
      B: [1, 2, 3, 4, 5],
      I: [16, 17, 18, 19, 20],
      N: [31, 32, 0, 34, 35],
      G: [46, 47, 48, 49, 50],
      O: [61, 62, 63, 64, 65]
    };

    // Row 1 is [1, 16, 31, 46, 61]
    const calledFor = [1, 16, 31, 46, 61, 10, 25];
    const result = verifyWinningPatterns(mockCard, calledFor);

    expect(result.hasWon).toBe(true);
    expect(result.patterns['Row 1']).toBeDefined();
    expect(result.patterns['Row 1']).toEqual([1, 16, 31, 46, 61]);
    expect(result.patternTypes.hasLine).toBe(true);
  });

  it('verifies Vertical Column win patterns correctly (including FREE center for N)', () => {
    const mockCard: BingoGrid = {
      B: [2, 6, 7, 10, 13],
      I: [16, 20, 23, 27, 28],
      N: [32, 37, 0, 39, 44],
      G: [50, 51, 54, 55, 56],
      O: [61, 62, 64, 70, 72]
    };

    // Column B is [2, 6, 7, 10, 13]
    const calledB = [2, 6, 7, 10, 13];
    const resB = verifyWinningPatterns(mockCard, calledB);
    expect(resB.hasWon).toBe(true);
    expect(resB.patterns['Column B']).toEqual([2, 6, 7, 10, 13]);

    // Column N is [32, 37, 0, 39, 44] -> center 0 is free
    const calledN = [32, 37, 39, 44];
    const resN = verifyWinningPatterns(mockCard, calledN);
    expect(resN.hasWon).toBe(true);
    expect(resN.patterns['Column N']).toEqual([32, 37, 0, 39, 44]);
  });

  it('verifies Diagonal win patterns correctly', () => {
    const mockCard: BingoGrid = {
      B: [1, 2, 3, 4, 5],
      I: [16, 17, 18, 19, 20],
      N: [31, 32, 0, 34, 35],
      G: [46, 47, 48, 49, 50],
      O: [61, 62, 63, 64, 65]
    };

    // Diagonal TL-BR: [1, 17, 0, 49, 65]
    const calledDiag1 = [1, 17, 49, 65];
    const resDiag1 = verifyWinningPatterns(mockCard, calledDiag1);
    expect(resDiag1.hasWon).toBe(true);
    expect(resDiag1.patterns['Diagonal TL-BR']).toEqual([1, 17, 0, 49, 65]);

    // Diagonal BL-TR (or TR-BL): [matrix[0][4], matrix[1][3], matrix[2][2], matrix[3][1], matrix[4][0]] -> [61, 47, 0, 19, 5]
    const calledDiag2 = [5, 19, 47, 61];
    const resDiag2 = verifyWinningPatterns(mockCard, calledDiag2);
    expect(resDiag2.hasWon).toBe(true);
    expect(resDiag2.patterns['Diagonal BL-TR']).toEqual([61, 47, 0, 19, 5]);
  });

  it('verifies Four Corners win patterns correctly', () => {
    const mockCard: BingoGrid = {
      B: [2, 4, 6, 8, 10],
      I: [16, 18, 20, 22, 24],
      N: [31, 33, 0, 37, 39],
      G: [46, 48, 50, 52, 54],
      O: [62, 64, 66, 68, 70]
    };

    // Four corners: [2, 62, 10, 70]
    const calledCorners = [2, 62, 10, 70, 33];
    const resCorners = verifyWinningPatterns(mockCard, calledCorners);
    expect(resCorners.hasWon).toBe(true);
    expect(resCorners.patterns['Four Corners']).toEqual([2, 62, 10, 70]);
    expect(resCorners.patternTypes.hasCorners).toBe(true);
  });

  it('verifies Full House (Blackout) win patterns correctly', () => {
    const mockCard: BingoGrid = {
      B: [1, 2, 3, 4, 5],
      I: [16, 17, 18, 19, 20],
      N: [31, 32, 0, 34, 35],
      G: [46, 47, 48, 49, 50],
      O: [61, 62, 63, 64, 65]
    };

    const allNumbers = [1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 31, 32, 34, 35, 46, 47, 48, 49, 50, 61, 62, 63, 64, 65];
    const resFull = verifyWinningPatterns(mockCard, allNumbers);
    expect(resFull.hasWon).toBe(true);
    expect(resFull.patterns['Full House']).toBeDefined();
    expect(resFull.patternTypes.hasFullHouse).toBe(true);
  });

  it('computes repeatable SHA-256 commitment hash and ticket fingerprint', () => {
    const balls = [71, 6, 49, 70, 19, 56];
    const seed = '9b6df7d3910c2c31e6720f4c3911f92e85a6a43e49392e9d96c14ab60b9432f1';
    const hash1 = computeCommitmentHash(balls, seed);
    const hash2 = computeCommitmentHash(balls, seed);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('generates a full 200-card catalog with valid numbered grids', () => {
    const catalog = generateCardCatalog(200);
    expect(catalog.size).toBe(200);
    expect(catalog.has(1)).toBe(true);
    expect(catalog.has(200)).toBe(true);
    expect(catalog.get(1)?.B).toHaveLength(5);
    expect(catalog.get(200)?.N[2]).toBe(0);
  });

  it('calculates Pari-Mutuel prize pool with 80% winner / 20% house rake (> 5 cards)', () => {
    const pool = calculatePariMutuelPool({
      betPerCard: 10.0,
      totalCardsSold: 10,
      houseRakePercent: 20.0
    });

    expect(pool.totalPot).toBe(100.0);
    expect(pool.houseRakePercent).toBe(20.0);
    expect(pool.houseRakeAmount).toBe(20.0);
    expect(pool.winnerPayoutPercent).toBe(80.0);
    expect(pool.winnerPayoutAmount).toBe(80.0);
    expect(pool.isFivePlayerBonus).toBe(false);
  });

  it('calculates Pari-Mutuel prize pool with 100% winner / 0% house rake for 5 cards bonus (<= 5 cards)', () => {
    const pool = calculatePariMutuelPool({
      betPerCard: 10.0,
      totalCardsSold: 5
    });

    expect(pool.totalPot).toBe(50.0);
    expect(pool.houseRakePercent).toBe(0);
    expect(pool.houseRakeAmount).toBe(0);
    expect(pool.winnerPayoutPercent).toBe(100.0);
    expect(pool.winnerPayoutAmount).toBe(50.0);
    expect(pool.isFivePlayerBonus).toBe(true);
  });
});
