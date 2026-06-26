import { create } from 'zustand';
import { insforge } from '../lib/insforge';

export type PlayerColor = 'emerald' | 'blue' | 'red' | 'amber';
export type TokenState = 'base' | 'track' | 'homePath' | 'goal';

export interface Token {
  id: number;
  color: PlayerColor;
  state: TokenState;
  position: number; // For track: 0-51. For homePath: 0-4. For base/goal: 0
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
  winner: PlayerColor | null;
  roomId: string | null;
}

interface GameStore extends GameState {
  rollDice: () => void;
  moveToken: (tokenId: number, color: PlayerColor) => void;
  passTurn: () => void;
  syncState: (state: Partial<GameState>) => void;
  setRoom: (roomId: string) => void;
  initGameConfig: (playerCount: number, bots: Record<PlayerColor, boolean>) => void;
}

const COLORS: PlayerColor[] = ['emerald', 'blue', 'red', 'amber'];
const START_INDICES: Record<PlayerColor, number> = { emerald: 0, blue: 13, red: 26, amber: 39 };
const END_INDICES: Record<PlayerColor, number> = { emerald: 50, blue: 11, red: 24, amber: 37 };
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const getInitialTokens = (): Token[] => {
  const tokens: Token[] = [];
  COLORS.forEach((color) => {
    for (let i = 0; i < 4; i++) {
      tokens.push({ id: i, color, state: 'base', position: 0 });
    }
  });
  return tokens;
};

export const useGameStore = create<GameStore>((set, get) => ({
  tokens: getInitialTokens(),
  currentTurn: 'emerald',
  diceRoll: null,
  consecutiveSixes: 0,
  hasRolled: false,
  bonusRoll: false,
  players: ['emerald', 'blue', 'red', 'amber'],
  playerCount: 4,
  bots: { emerald: false, blue: false, red: false, amber: false },
  winner: null,
  roomId: null,

  setRoom: (roomId) => set({ roomId }),

  initGameConfig: (playerCount, bots) => {
    const players = COLORS.slice(0, playerCount);
    set({ playerCount, bots, players, currentTurn: players[0] });
  },

  syncState: (newState) => set((state) => ({ ...state, ...newState })),

  rollDice: () => {
    const state = get();
    if (state.hasRolled && !state.bonusRoll) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    // const roll = 6; // For testing

    let nextConsecutiveSixes = state.consecutiveSixes;
    if (roll === 6) {
      nextConsecutiveSixes++;
    } else {
      nextConsecutiveSixes = 0;
    }

    if (nextConsecutiveSixes === 3) {
      // Rule of three 6s
      const currentIdx = state.players.indexOf(state.currentTurn);
      const nextTurn = state.players[(currentIdx + 1) % state.players.length];
      const newState = {
        diceRoll: null,
        hasRolled: false,
        consecutiveSixes: 0,
        bonusRoll: false,
        currentTurn: nextTurn,
      };
      set(newState);
      if (state.roomId) broadcastState(state.roomId, newState);
      return;
    }

    const hasValidMoves = checkValidMoves(state.tokens, state.currentTurn, roll);

    if (!hasValidMoves) {
      // Pass turn if no moves
      setTimeout(() => get().passTurn(), 1000);
    }

    const newState = {
      diceRoll: roll,
      hasRolled: true,
      consecutiveSixes: nextConsecutiveSixes,
      bonusRoll: roll === 6,
    };
    
    set(newState);
    if (state.roomId) broadcastState(state.roomId, newState);
  },

  moveToken: (tokenId, color) => {
    const state = get();
    if (state.currentTurn !== color || state.diceRoll === null) return;

    const tokenIndex = state.tokens.findIndex((t) => t.id === tokenId && t.color === color);
    if (tokenIndex === -1) return;

    const token = state.tokens[tokenIndex];
    let newTokens = [...state.tokens];
    let newToken = { ...token };
    const roll = state.diceRoll;

    let moveValid = false;
    let captureMade = false;

    if (token.state === 'base') {
      if (roll === 6) {
        newToken.state = 'track';
        newToken.position = START_INDICES[color];
        moveValid = true;
      }
    } else if (token.state === 'track') {
      let currentPos = token.position;
      let remainingSteps = roll;
      const endIdx = END_INDICES[color];

      // Calculate distance to end
      let distanceToEnd = endIdx >= currentPos ? endIdx - currentPos : (52 - currentPos) + endIdx;

      if (remainingSteps > distanceToEnd) {
        // Enter home path
        remainingSteps -= distanceToEnd;
        newToken.state = 'homePath';
        // Need exact entry: 1 step enters position 0. 5 steps enters position 4. 6 steps enters goal.
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

    if (!moveValid) return;

    newTokens[tokenIndex] = newToken;

    // Check for captures
    if (newToken.state === 'track' && !SAFE_ZONES.includes(newToken.position)) {
      const opponents = newTokens.filter(
        (t) => t.color !== color && t.state === 'track' && t.position === newToken.position
      );
      if (opponents.length > 0) {
        // Capture them
        opponents.forEach((opp) => {
          const idx = newTokens.findIndex((t) => t.id === opp.id && t.color === opp.color);
          newTokens[idx] = { ...newTokens[idx], state: 'base', position: 0 };
        });
        captureMade = true;
      }
    }

    // Determine next turn
    let nextTurn = state.currentTurn;
    let newHasRolled = false;
    let newBonusRoll = false;
    let newConsecutive = state.consecutiveSixes;

    if (state.bonusRoll || captureMade) {
      newBonusRoll = false; // Need to roll again for bonus
    } else {
      const currentIdx = state.players.indexOf(state.currentTurn);
      nextTurn = state.players[(currentIdx + 1) % state.players.length];
      newConsecutive = 0;
    }

    // Check win condition
    const hasWon = newTokens.filter((t) => t.color === color && t.state === 'goal').length === 4;

    const newState = {
      tokens: newTokens,
      diceRoll: null,
      currentTurn: nextTurn,
      hasRolled: newHasRolled,
      bonusRoll: newBonusRoll,
      consecutiveSixes: newConsecutive,
      winner: hasWon ? color : state.winner,
    };

    set(newState);
    if (state.roomId) broadcastState(state.roomId, newState);
  },

  passTurn: () => {
    const state = get();
    if (!state.hasRolled) return;

    const currentIdx = state.players.indexOf(state.currentTurn);
    const nextTurn = state.players[(currentIdx + 1) % state.players.length];
    
    const newState = {
      diceRoll: null,
      hasRolled: false,
      consecutiveSixes: 0,
      bonusRoll: false,
      currentTurn: nextTurn,
    };
    
    set(newState);
    if (state.roomId) broadcastState(state.roomId, newState);
  }
}));

const checkValidMoves = (tokens: Token[], color: PlayerColor, roll: number): boolean => {
  const myTokens = tokens.filter((t) => t.color === color);
  for (const t of myTokens) {
    if (t.state === 'base' && roll === 6) return true;
    if (t.state === 'track') return true; // Technically always can move, unless exact home entry fails, but for simplicity here we assume true, though we should check exact home
    if (t.state === 'homePath' && t.position + roll <= 5) return true;
  }
  return false;
};

const broadcastState = (roomId: string, stateUpdate: Partial<GameState>) => {
  insforge.realtime.publish(`room:${roomId}`, 'STATE_UPDATE', stateUpdate);
  const fullState = useGameStore.getState();
  // Persist to database so `postgres_changes` pushes it to other clients
  insforge.database.from('rooms').update({ state: fullState }).eq('id', roomId).then();
};
