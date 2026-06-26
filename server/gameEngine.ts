export type PlayerColor = 'emerald' | 'blue' | 'red' | 'amber';
export type TokenState = 'base' | 'track' | 'homePath' | 'goal';

export interface Token {
  id: number;
  color: PlayerColor;
  state: TokenState;
  position: number;
}

export interface GameState {
  tokens: Token[];
  currentTurn: PlayerColor;
  diceRoll: number | null;
  consecutiveSixes: number;
  hasRolled: boolean;
  bonusRoll: boolean;
  players: PlayerColor[];
  playerCount: number;
  bots: Record<PlayerColor, boolean>;
  winners: PlayerColor[];
  gameStatus: 'waiting' | 'playing' | 'paused' | 'finished';
  activePlayers: string[];
  roomId: string | null;
  points: Record<PlayerColor, number>;
  turnEndTime: number;
  gameEndTime: number;
  disconnectedPlayers: PlayerColor[];
}

const COLORS: PlayerColor[] = ['emerald', 'blue', 'red', 'amber'];
const START_INDICES: Record<PlayerColor, number> = { emerald: 1, amber: 14, blue: 27, red: 40 };
const END_INDICES: Record<PlayerColor, number> = { emerald: 51, amber: 12, blue: 25, red: 38 };
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

export const getInitialTokens = (): Token[] => {
  const tokens: Token[] = [];
  COLORS.forEach((color) => {
    for (let i = 0; i < 4; i++) {
      tokens.push({ id: i, color, state: 'base', position: 0 });
    }
  });
  return tokens;
};

export const getInitialGameState = (): GameState => ({
  tokens: getInitialTokens(),
  currentTurn: 'emerald',
  diceRoll: null,
  consecutiveSixes: 0,
  hasRolled: false,
  bonusRoll: false,
  players: ['emerald', 'blue', 'red', 'amber'],
  playerCount: 4,
  bots: { emerald: false, blue: false, red: false, amber: false },
  winners: [],
  gameStatus: 'waiting',
  activePlayers: [],
  roomId: null,
  points: { emerald: 0, blue: 0, red: 0, amber: 0 },
  turnEndTime: Date.now() + 15000,
  gameEndTime: Date.now() + 30 * 60000,
  disconnectedPlayers: [],
});

export const getValidTokens = (tokens: Token[], color: PlayerColor, roll: number): Token[] => {
  return tokens.filter((t) => t.color === color).filter((t) => {
    if (t.state === 'base' && roll === 6) return true;
    if (t.state === 'track') {
      const endIdx = END_INDICES[color];
      const distanceToEnd = endIdx >= t.position ? endIdx - t.position : (52 - t.position) + endIdx;
      if (roll <= distanceToEnd + 6) return true; // Can enter home path and reach up to goal
    }
    if (t.state === 'homePath') {
      const needed = 5 - t.position;
      if (roll <= needed) return true;
    }
    return false;
  });
};

export const rollDice = (state: GameState): GameState => {
  if (state.hasRolled && !state.bonusRoll) return state;

  const roll = Math.floor(Math.random() * 6) + 1;
  let nextConsecutiveSixes = state.consecutiveSixes;
  
  if (roll === 6) {
    nextConsecutiveSixes++;
  } else {
    nextConsecutiveSixes = 0;
  }

  if (nextConsecutiveSixes === 3) {
    let currentIdx = state.players.indexOf(state.currentTurn);
    let nextTurn = state.players[(currentIdx + 1) % state.playerCount];
    
    let loops = 0;
    do {
      currentIdx = (currentIdx + 1) % state.playerCount;
      nextTurn = state.players[currentIdx];
      loops++;
    } while (state.winners.includes(nextTurn) && loops < state.playerCount);

    return {
      ...state,
      diceRoll: null,
      hasRolled: false,
      consecutiveSixes: 0,
      bonusRoll: false,
      currentTurn: nextTurn,
      turnEndTime: Date.now() + 15000,
    };
  }


  const newState = {
    ...state,
    diceRoll: roll,
    hasRolled: true,
    consecutiveSixes: nextConsecutiveSixes,
    bonusRoll: roll === 6,
    turnEndTime: Date.now() + 15000,
  };

  // If exactly 1 valid token and it's not a bot, auto-move logic will be handled by the client or server later.
  // For now, just return the state. We can auto-move in index.ts if we want.
  
  return newState;
};

export const passTurn = (state: GameState): GameState => {
  let currentIdx = state.players.indexOf(state.currentTurn);
  let nextTurn = state.players[(currentIdx + 1) % state.playerCount];
  
  let loops = 0;
  do {
    currentIdx = (currentIdx + 1) % state.playerCount;
    nextTurn = state.players[currentIdx];
    loops++;
  } while (state.winners.includes(nextTurn) && loops < state.playerCount);
  
  return {
    ...state,
    diceRoll: null,
    hasRolled: false,
    consecutiveSixes: 0,
    bonusRoll: false,
    currentTurn: nextTurn,
    turnEndTime: Date.now() + 15000,
  };
};

export const getStepsTaken = (t: Token, color: PlayerColor): number => {
  if (t.state === 'base') return 0;
  const startIdx = START_INDICES[color];
  if (t.state === 'track') return t.position >= startIdx ? t.position - startIdx + 1 : (52 - startIdx) + t.position + 1;
  if (t.state === 'homePath') return 51 + t.position + 1;
  if (t.state === 'goal') return 57;
  return 0;
};

export const autoPlay = (state: GameState): GameState => {
  if (state.gameStatus !== 'playing') return state;

  if (!state.hasRolled) {
    const rolledState = rollDice(state);
    return autoMove(rolledState);
  } else {
    return autoMove(state);
  }
};

const autoMove = (state: GameState): GameState => {
  if (state.diceRoll === null) return passTurn(state);

  const validTokens = getValidTokens(state.tokens, state.currentTurn, state.diceRoll);
  if (validTokens.length === 0) {
    return passTurn(state);
  }

  validTokens.sort((a, b) => {
    const aSteps = getStepsTaken(a, state.currentTurn);
    const bSteps = getStepsTaken(b, state.currentTurn);
    const aSafe = a.state === 'track' && SAFE_ZONES.includes(a.position);
    const bSafe = b.state === 'track' && SAFE_ZONES.includes(b.position);
    
    if (aSafe !== bSafe) return aSafe ? 1 : -1;
    return bSteps - aSteps;
  });

  return moveToken(state, validTokens[0].id, state.currentTurn);
};

export const moveToken = (state: GameState, tokenId: number, color: PlayerColor): GameState => {
  if (state.currentTurn !== color || state.diceRoll === null) return state;

  const tokenIndex = state.tokens.findIndex((t) => t.id === tokenId && t.color === color);
  if (tokenIndex === -1) return state;

  const token = state.tokens[tokenIndex];
  let newTokens = [...state.tokens];
  let newToken = { ...token };
  const roll = state.diceRoll;

  let moveValid = false;
  let captureMade = false;
  let newPoints = { ...state.points };

  if (token.state === 'base') {
    if (roll === 6) {
      newToken.state = 'track';
      newToken.position = START_INDICES[color];
      moveValid = true;
      newPoints[color] += 1;
    }
  } else if (token.state === 'track') {
    let currentPos = token.position;
    let remainingSteps = roll;
    const endIdx = END_INDICES[color];

    let distanceToEnd = endIdx >= currentPos ? endIdx - currentPos : (52 - currentPos) + endIdx;

    if (remainingSteps > distanceToEnd) {
      remainingSteps -= distanceToEnd;
      newToken.state = 'homePath';
      if (remainingSteps <= 5) {
        newToken.position = remainingSteps - 1;
        moveValid = true;
      } else if (remainingSteps === 6) {
        newToken.state = 'goal';
        newToken.position = 0;
        moveValid = true;
      }
    } else {
      newToken.position = (currentPos + remainingSteps) % 52;
      moveValid = true;
    }
  } else if (token.state === 'homePath') {
    const neededToGoal = 5 - token.position;
    if (roll === neededToGoal) {
      newToken.state = 'goal';
      newToken.position = 0;
      moveValid = true;
    } else if (roll < neededToGoal) {
      newToken.position += roll;
      moveValid = true;
    }
  }

  if (!moveValid) return state;

  if (token.state !== 'base') {
    newPoints[color] += roll;
  }

  newTokens[tokenIndex] = newToken;

  if (newToken.state === 'track' && !SAFE_ZONES.includes(newToken.position)) {
    const opponents = newTokens.filter(
      (t) => t.color !== color && t.state === 'track' && t.position === newToken.position
    );
    if (opponents.length > 0) {
      opponents.forEach((opp) => {
        const idx = newTokens.findIndex((t) => t.id === opp.id && t.color === opp.color);
        newTokens[idx] = { ...newTokens[idx], state: 'base', position: 0 };
        newPoints[opp.color] -= getStepsTaken(opp, opp.color);
      });
      captureMade = true;
      newPoints[color] += 10;
    }
  }

  const tokenHasReachedGoal = newToken.state === 'goal' && token.state !== 'goal';
  const hasWon = newTokens.filter((t) => t.color === color && t.state === 'goal').length === 4;
  
  let newWinners = [...state.winners];
  if (hasWon && !newWinners.includes(color)) {
    newWinners.push(color);
  }

  let nextTurn = state.currentTurn;
  let newHasRolled = false;
  let newBonusRoll = false;
  let newConsecutive = state.consecutiveSixes;
  let newTurnEndTime = Date.now() + 15000;

  // Grant a bonus roll for capturing OR reaching goal
  if ((state.bonusRoll || captureMade || tokenHasReachedGoal) && !hasWon) {
    newBonusRoll = false; 
  } else {
    let currentIdx = state.players.indexOf(state.currentTurn);
    let loops = 0;
    do {
      currentIdx = (currentIdx + 1) % state.playerCount;
      nextTurn = state.players[currentIdx];
      loops++;
    } while (newWinners.includes(nextTurn) && loops < state.playerCount);
    
    newConsecutive = 0;
  }

  let newGameStatus = state.gameStatus;
  // If all but one player has finished (or if only 1 player game and they finish)
  if (newWinners.length >= state.playerCount - 1 && state.playerCount > 1) {
    newGameStatus = 'finished';
  } else if (newWinners.length === 1 && state.playerCount === 1) {
    newGameStatus = 'finished';
  }

  return {
    ...state,
    tokens: newTokens,
    diceRoll: null,
    currentTurn: nextTurn,
    hasRolled: newHasRolled,
    bonusRoll: newBonusRoll,
    consecutiveSixes: newConsecutive,
    winners: newWinners,
    gameStatus: newGameStatus,
    points: newPoints,
    turnEndTime: newTurnEndTime,
  };
};
