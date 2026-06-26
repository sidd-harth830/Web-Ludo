import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { insforge } from '../lib/insforge';
import { GameBoard } from '../components/GameBoard';
import { ChatPanel } from '../components/ChatPanel';
import { useGameStore } from '../store/gameStore';
import type { PlayerColor, GameState } from '../store/gameStore';
import { MessageSquare, Clock } from 'lucide-react';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<PlayerColor | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [colorNames, setColorNames] = useState<Record<string, string>>({});
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

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
      // Fetch Room Config & Expiration
      const { data: roomData } = await insforge.database.from('rooms').select('state, status, expires_at').eq('id', roomId).maybeSingle();
      if (roomData) {
        if ((roomData as any).status === 'expired') {
          setIsExpired(true);
        }
        if ((roomData as any).expires_at) {
          setExpiresAt(new Date((roomData as any).expires_at));
        }
        const state = (roomData as any).state;
        if (state) {
          useGameStore.getState().initGameConfig(
            state.playerCount || 4, 
            state.bots || { emerald: false, blue: false, red: false, amber: false }
          );
        }
      }

      // Fetch player info & usernames
      const { data: players } = await insforge.database
        .from('room_players')
        .select('color, user_id, is_host, users(username)')
        .eq('room_id', roomId);
      
      if (players) {
        const pNames: Record<string, string> = {};
        const cNames: Record<string, string> = {};
        
        players.forEach((p: any) => {
          const uname = p.users?.username || 'Unknown';
          pNames[p.user_id] = uname;
          cNames[p.color] = uname;
          if (p.user_id === storedUserId) {
            setPlayerColor(p.color as PlayerColor);
            setIsHost(p.is_host);
          }
        });
        setPlayerNames(pNames);
        setColorNames(cNames);
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

  // Expiration Timer Effect
  useEffect(() => {
    if (!expiresAt || isExpired) return;

    const updateTimer = async () => {
      const now = new Date().getTime();
      const target = expiresAt.getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        setIsExpired(true);
        if (isHost && roomId) {
          await insforge.database.from('rooms').update({ status: 'expired' }).eq('id', roomId);
        }
      } else {
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isExpired, isHost, roomId]);

  // Bot logic trigger
  useEffect(() => {
    if (!isHost || !botWorkerRef.current || !roomId || isExpired) return;
    
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
  }, [currentTurn, diceRoll, isHost, roomId, tokens, isExpired]);

  if (!playerColor || !userId) return <div className="p-8 flex items-center justify-center h-screen bg-[var(--bg-primary)]">Loading Room...</div>;

  const state = useGameStore.getState();
  const isBotTurn = state.bots[currentTurn];

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row bg-[var(--bg-primary)] relative">
      
      {/* Expiration Overlay */}
      {isExpired && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-8 flex flex-col items-center gap-6 max-w-sm text-center shadow-2xl scale-105 transition-transform animate-in zoom-in duration-300">
            <h2 className="text-3xl font-bold text-red-500">Room Expired</h2>
            <p className="text-slate-200">The 30-minute time limit for this room has ended.</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold transition-all w-full"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}

      {/* Left panel */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto border-b md:border-b-0 md:border-r border-[var(--panel-border)]">
        
        {timeLeft && !isExpired && (
          <div className="glass-panel p-4 flex items-center justify-center gap-3 bg-red-500/10 border-red-500/30">
            <Clock className="text-red-500" size={20} />
            <div className="font-mono text-xl font-bold text-red-500">{timeLeft}</div>
          </div>
        )}

        <div className="glass-panel p-5 flex justify-between items-center md:flex-col md:items-start md:gap-4">
          <div>
            <h2 className="text-xl font-bold">
              Room: <span className="font-mono text-[var(--highlight-secondary)]">{roomId?.substring(0, 8)}</span>
            </h2>
            <p className="text-sm mt-1 opacity-80">
              Playing as <span className={`font-bold text-${playerColor}-500 capitalize`}>{colorNames[playerColor] || playerColor}</span>
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
      <div className="flex-1 w-full h-full min-w-0 min-h-0 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden">
        <GameBoard playerColor={playerColor} colorNames={colorNames} />
      </div>

      {/* Right Chat (Desktop) / Modal (Mobile) */}
      <div className={`
        fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:static md:bg-transparent md:backdrop-blur-none md:w-80 md:flex-shrink-0 md:h-full md:border-l border-[var(--panel-border)] md:z-auto transition-all duration-300
        ${showChat ? 'opacity-100 pointer-events-auto flex items-end md:block' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:block'}
      `}>
        <div className={`w-full h-[70vh] md:h-full flex flex-col transition-transform duration-300 bg-[var(--bg-primary)] md:bg-transparent rounded-t-2xl md:rounded-none ${showChat ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
           <div className="flex-1 w-full h-full overflow-hidden relative">
             {roomId && userId && <ChatPanel roomId={roomId} userId={userId} userMap={playerNames} onClose={() => setShowChat(false)} />}
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
