import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState, getInitialGameState, rollDice, moveToken, passTurn, getValidTokens, PlayerColor, autoPlay } from './gameEngine';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map<string, GameState>();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('JOIN_ROOM', (roomId: string, userMetadata: { username: string, color: PlayerColor }, roomConfig?: { playerCount: number, bots: Record<PlayerColor, boolean> }) => {
    socket.join(roomId);
    socket.data = { roomId, username: userMetadata.username, color: userMetadata.color };
    
    if (!rooms.has(roomId)) {
      const initialState = getInitialGameState();
      initialState.roomId = roomId;
      if (roomConfig) {
        initialState.playerCount = roomConfig.playerCount;
        initialState.bots = roomConfig.bots;
      }
      rooms.set(roomId, initialState);
    }
    
    const state = rooms.get(roomId)!;
    if (!state.activePlayers.includes(userMetadata.username)) {
      state.activePlayers.push(userMetadata.username);
    }
    state.disconnectedPlayers = state.disconnectedPlayers.filter(c => c !== userMetadata.color);

    const requiredHumans = state.playerCount - Object.values(state.bots).filter(Boolean).length;
    if (state.activePlayers.length >= requiredHumans && (state.gameStatus === 'waiting' || state.gameStatus === 'paused')) {
      state.gameStatus = 'playing';
      state.turnEndTime = Date.now() + 15000; // Reset timer when unpausing
    }
    
    console.log(`Room ${roomId} required humans: ${requiredHumans}, active: ${state.activePlayers.length}, status: ${state.gameStatus}`);

    // Broadcast the initial state
    io.to(roomId).emit('STATE_UPDATE', state);
  });

  socket.on('REQUEST_ROLL', (roomId: string) => {
    const state = rooms.get(roomId);
    if (!state) return;

    const newState = rollDice(state);
    rooms.set(roomId, newState);

    io.to(roomId).emit('STATE_UPDATE', newState);

    // Auto-move logic if exactly 1 token is valid and it's not a bot
    const validTokens = getValidTokens(newState.tokens, newState.currentTurn, newState.diceRoll!);
    if (validTokens.length === 1 && !newState.bots[newState.currentTurn]) {
      setTimeout(() => {
        const autoMoveState = moveToken(rooms.get(roomId)!, validTokens[0].id, newState.currentTurn);
        rooms.set(roomId, autoMoveState);
        io.to(roomId).emit('STATE_UPDATE', autoMoveState);
      }, 500);
    } else if (validTokens.length === 0 && newState.diceRoll !== null) {
      setTimeout(() => {
        const passedState = passTurn(rooms.get(roomId)!);
        rooms.set(roomId, passedState);
        io.to(roomId).emit('STATE_UPDATE', passedState);
      }, 1000);
    }
  });

  socket.on('REQUEST_MOVE', (roomId: string, tokenId: number, color: PlayerColor) => {
    const state = rooms.get(roomId);
    if (!state) return;

    const newState = moveToken(state, tokenId, color);
    rooms.set(roomId, newState);
    
    io.to(roomId).emit('STATE_UPDATE', newState);
  });

  socket.on('SEND_CHAT', (roomId: string, message: { id: string, text: string, username: string, color: string, timestamp: string }) => {
    io.to(roomId).emit('NEW_CHAT', message);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const { roomId, username, color } = socket.data;
    if (roomId && username && color) {
      const state = rooms.get(roomId);
      if (state) {
        state.activePlayers = state.activePlayers.filter(p => p !== username);
        if (!state.disconnectedPlayers.includes(color)) {
          state.disconnectedPlayers.push(color);
        }
        
        io.to(roomId).emit('PLAYER_LEFT', username);

        const requiredHumans = state.playerCount - Object.values(state.bots).filter(Boolean).length;
        if (state.activePlayers.length < requiredHumans && state.activePlayers.length > 0 && state.gameStatus === 'playing') {
          state.gameStatus = 'paused';
        } else if (state.activePlayers.length === 0) {
          rooms.delete(roomId);
        }

        if (state.activePlayers.length > 0) {
          io.to(roomId).emit('STATE_UPDATE', state);
        }
      }
    }
  });
});

// Game Loop for Timers
setInterval(() => {
  const now = Date.now();
  for (const [roomId, state] of rooms.entries()) {
    if (state.gameStatus === 'playing') {
      let stateChanged = false;

      // Check Game Timer
      if (now >= state.gameEndTime) {
        state.gameStatus = 'finished';
        
        // Rank winners based on points
        const sortedColors = state.players.sort((a, b) => state.points[b] - state.points[a]);
        state.winners = sortedColors;
        stateChanged = true;
      } 
      // Check Turn Timer
      else if (now >= state.turnEndTime && !state.bots[state.currentTurn]) {
        const nextState = autoPlay(state);
        rooms.set(roomId, nextState);
        stateChanged = true;
      }

      if (stateChanged) {
        io.to(roomId).emit('STATE_UPDATE', rooms.get(roomId));
      }
    }
  }
}, 1000);

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Authoritative Game Server running on port ${PORT}`);
});
