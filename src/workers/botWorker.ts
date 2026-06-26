import type { GameState, Token, PlayerColor } from '../store/gameStore';

// Ludo Bot Heuristics Worker
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const END_INDICES: Record<PlayerColor, number> = { emerald: 50, amber: 11, blue: 24, red: 37 };

self.onmessage = (e: MessageEvent<{ type: string; state: GameState; color: PlayerColor }>) => {
  if (e.data.type === 'CALCULATE_MOVE') {
    const { state, color } = e.data;
    const bestMove = calculateBestMove(state, color);
    
    // Simulate thinking delay
    setTimeout(() => {
      self.postMessage({ type: 'MOVE_RESULT', tokenId: bestMove });
    }, 1500);
  }
};

function calculateBestMove(state: GameState, color: PlayerColor): number | null {
  const roll = state.diceRoll;
  if (!roll) return null;

  const myTokens = state.tokens.filter(t => t.color === color);
  const opponents = state.tokens.filter(t => t.color !== color);

  let bestScore = -Infinity;
  let bestTokenId: number | null = null;

  for (const token of myTokens) {
    if (token.state === 'goal') continue;

    let score = evaluateMove(token, roll, color, opponents);
    
    if (score !== null && score > bestScore) {
      bestScore = score;
      bestTokenId = token.id;
    }
  }

  return bestTokenId;
}

function evaluateMove(token: Token, roll: number, color: PlayerColor, opponents: Token[]): number | null {
  if (token.state === 'base') {
    if (roll === 6) return 4000; // Massive priority to get out of base
    return null;
  }

  if (token.state === 'homePath') {
    const needed = 5 - token.position;
    if (roll === needed) return 100; // Entering goal!
    if (roll < needed) return 10; // Moving up home path
    return null; // Invalid (exact entry required)
  }

  if (token.state === 'track') {
    let score = 0;
    const currentPos = token.position;
    const endIdx = END_INDICES[color];
    const distanceToEnd = endIdx >= currentPos ? endIdx - currentPos : (52 - currentPos) + endIdx;

    if (roll > distanceToEnd) {
      // Enters home path
      const remaining = roll - distanceToEnd;
      if (remaining <= 5) return 30 + remaining; // Bonus for entering home path
      if (remaining === 6) return 100; // Straight to goal
      return null;
    }

    const newPos = (currentPos + roll) % 52;
    score += roll; // Base score for advancing

    if (SAFE_ZONES.includes(newPos)) {
      score += 20; // Bonus for reaching a safe zone
    }

    // Check for captures
    const capturePossible = opponents.some(
      opp => opp.state === 'track' && opp.position === newPos && !SAFE_ZONES.includes(newPos)
    );

    if (capturePossible) {
      score += 50; // Bonus for capture (weighted highly but not strictly mandatory)
    }

    return score;
  }

  return null;
}
