import { create } from 'zustand';

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
  isSocketConnected: boolean;
  points: Record<PlayerColor, number>;
  turnEndTime: number;
  gameEndTime: number;
  disconnectedPlayers: PlayerColor[];
}

interface GameStore extends GameState {
  forceSyncState: (serverState: Partial<GameState>) => void;
  resetGame: () => void;
  setSocketConnected: (connected: boolean) => void;
}

export const getValidTokens = (tokens: Token[], color: PlayerColor, roll: number): Token[] => {
  return tokens.filter((t) => t.color === color).filter((t) => {
    if (t.state === 'base' && roll === 6) return true;
    if (t.state === 'track') {
      const endIdx = color === 'emerald' ? 51 : color === 'amber' ? 12 : color === 'blue' ? 25 : 38;
      const distanceToEnd = endIdx >= t.position ? endIdx - t.position : (52 - t.position) + endIdx;
      if (roll <= distanceToEnd + 6) return true;
    }
    if (t.state === 'homePath') {
      const needed = 5 - t.position;
      if (roll <= needed) return true;
    }
    return false;
  });
};

export const useGameStore = create<GameStore>((set) => ({
  tokens: [],
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
  isSocketConnected: false,
  points: { emerald: 0, blue: 0, red: 0, amber: 0 },
  turnEndTime: 0,
  gameEndTime: 0,
  disconnectedPlayers: [],

  forceSyncState: (serverState) => {
    set((state) => ({ ...state, ...serverState }));
  },

  resetGame: () => {
    set({
      tokens: [],
      currentTurn: 'emerald',
      diceRoll: null,
      consecutiveSixes: 0,
      hasRolled: false,
      bonusRoll: false,
      winners: [],
      gameStatus: 'waiting',
      activePlayers: [],
      isSocketConnected: false,
      points: { emerald: 0, blue: 0, red: 0, amber: 0 },
      turnEndTime: 0,
      gameEndTime: 0,
      disconnectedPlayers: [],
    });
  },

  setSocketConnected: (connected: boolean) => {
    set({ isSocketConnected: connected });
  },
}));
