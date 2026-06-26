import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { insforge } from '../lib/insforge';
import { GameBoard } from '../components/GameBoard';
import { ChatPanel } from '../components/ChatPanel';
import { useGameStore } from '../store/gameStore';
import type { PlayerColor, GameState } from '../store/gameStore';
import { MessageSquare } from 'lucide-react';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<PlayerColor | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const { setRoom, syncState, currentTurn, tokens, diceRoll } = useGameStore();
  const botWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem('ludo_user_id');
    if (!storedUserId || !roomId) {
      navigate('/');
      return;
    }
    setUserId(storedUserId);
    setRoom(roomId);

    const initRoom = async () => {
      // Fetch Room Config
      const { data: roomData } = await insforge.database.from('rooms').select('state').eq('id', roomId).maybeSingle();
      if (roomData && (roomData as any).state) {
        const state = (roomData as any).state;
        useGameStore.getState().initGameConfig(
          state.playerCount || 4, 
          state.bots || { emerald: false, blue: false, red: false, amber: false }
        );
      }

      // Fetch player info
      const { data } = await insforge.database
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', storedUserId)
        .maybeSingle();
      
      if (data) {
        setPlayerColor((data as any).color as PlayerColor);
        setIsHost((data as any).is_host);
      }
    };
    initRoom();

    // Subscribe to state updates via realtime
    const setupRealtime = async () => {
      await insforge.realtime.connect();
      await insforge.realtime.subscribe(`room:${roomId}`);
      insforge.realtime.on<{ payload: Partial<GameState> }>('STATE_UPDATE', (payload) => {
        if (payload?.payload) {
          syncState(payload.payload);
        }
      });
    };
    setupRealtime();

    // Setup Bot Worker
    botWorkerRef.current = new Worker(new URL('../workers/botWorker.ts', import.meta.url), { type: 'module' });
    botWorkerRef.current.onmessage = (e) => {
      if (e.data.type === 'MOVE_RESULT') {
        const turn = useGameStore.getState().currentTurn;
        if (e.data.tokenId !== null) {
          useGameStore.getState().moveToken(e.data.tokenId, turn);
        } else {
          useGameStore.getState().passTurn();
        }
      }
    };

    return () => {
      insforge.realtime.unsubscribe(`room:${roomId}`);
      botWorkerRef.current?.terminate();
    };
  }, [roomId, navigate, setRoom, syncState]);

  // Bot logic trigger
  useEffect(() => {
    if (!isHost || !botWorkerRef.current || !roomId) return;
    
    const state = useGameStore.getState();
    if (!state.bots[currentTurn]) return;

    if (diceRoll === null && !state.hasRolled) {
      // Roll the dice for the bot
      const timer = setTimeout(() => {
        useGameStore.getState().rollDice();
      }, 800);
      return () => clearTimeout(timer);
    } else if (diceRoll !== null && state.hasRolled) {
      // Calculate move
      const timer = setTimeout(() => {
        botWorkerRef.current?.postMessage({
          type: 'CALCULATE_MOVE',
          state: useGameStore.getState(),
          color: currentTurn
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, diceRoll, isHost, roomId, tokens]);

  if (!playerColor || !userId) return <div className="p-8 flex items-center justify-center h-screen bg-[var(--bg-primary)]">Loading Room...</div>;

  const state = useGameStore.getState();
  const isBotTurn = state.bots[currentTurn];

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row bg-[var(--bg-primary)]">
      
      {/* Left panel */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto border-b md:border-b-0 md:border-r border-[var(--panel-border)]">
        <div className="glass-panel p-5 flex justify-between items-center md:flex-col md:items-start md:gap-4">
          <div>
            <h2 className="text-xl font-bold">
              Room: <span className="font-mono text-[var(--highlight-secondary)]">{roomId?.substring(0, 8)}</span>
            </h2>
            <p className="text-sm mt-1 opacity-80">
              Playing as <span className={`font-bold text-${playerColor}-500 capitalize`}>{playerColor}</span>
            </p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors text-sm font-semibold border border-red-500/30 w-full md:w-auto text-center"
          >
            Leave
          </button>
        </div>

        <div className="glass-panel p-5 hidden md:block">
           <h3 className="font-bold mb-2 text-sm uppercase tracking-wider opacity-80">Current Turn</h3>
           <div className={`text-2xl font-bold capitalize text-${currentTurn}-500 flex items-center gap-2`}>
             {currentTurn} 
             {isBotTurn && <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full uppercase">Bot</span>}
           </div>
        </div>
      </div>

      {/* Center Board */}
      <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center p-2 md:p-4 overflow-hidden relative pb-20 md:pb-4">
        <GameBoard playerColor={playerColor} />
      </div>

      {/* Right Chat (Desktop) / Modal (Mobile) */}
      <div className={`
        fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:static md:bg-transparent md:backdrop-blur-none md:w-80 md:flex-shrink-0 md:h-full md:border-l border-[var(--panel-border)] md:z-auto transition-all duration-300
        ${showChat ? 'opacity-100 pointer-events-auto flex items-end md:block' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:block'}
      `}>
        <div className={`w-full h-[70vh] md:h-full flex flex-col transition-transform duration-300 bg-[var(--bg-primary)] md:bg-transparent rounded-t-2xl md:rounded-none ${showChat ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
           <div className="flex-1 w-full h-full overflow-hidden relative">
             {roomId && userId && <ChatPanel roomId={roomId} userId={userId} onClose={() => setShowChat(false)} />}
           </div>
        </div>
      </div>

      {/* Mobile Chat Toggle Button */}
      <button 
        onClick={() => setShowChat(true)}
        className="md:hidden fixed bottom-6 right-6 p-4 rounded-full bg-[var(--highlight-secondary)] text-white shadow-lg z-40 hover:scale-105 transition-transform"
      >
        <MessageSquare size={24} className="text-[var(--bg-primary)]" />
      </button>

    </div>
  );
};
