import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { insforge } from '../lib/insforge';
import { GameBoard } from '../components/GameBoard';
import { ChatPanel } from '../components/ChatPanel';
import { useGameStore } from '../store/gameStore';
import type { PlayerColor, GameState } from '../store/gameStore';
import { MessageSquare, Clock, Copy, Share2, Check } from 'lucide-react';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<PlayerColor | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [colorNames, setColorNames] = useState<Record<string, string>>({});
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [copied, setCopied] = useState(false);

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
      if (roomId === 'local') {
        setRoomCode('LOCAL');
        setIsHost(true);
        setPlayerColor('emerald');
        const colors = ['emerald', 'blue', 'red', 'amber'];
        const pNames: Record<string, string> = {};
        const cNames: Record<string, string> = {};
        colors.forEach(c => {
          cNames[c] = c === 'emerald' ? 'You' : 'Bot';
        });
        setColorNames(cNames);
        useGameStore.getState().syncState({ gameStatus: 'playing' });
        return;
      }

      // Fetch Room Config & Expiration
      const { data: roomData } = await insforge.database.from('rooms').select('code, state, status, expires_at').eq('id', roomId).maybeSingle();
      if (roomData) {
        setRoomCode((roomData as any).code || '');
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
        
        const state = useGameStore.getState();
        const humanCount = Object.values(state.bots).filter(b => !b).length;
        if (players.length >= humanCount) {
          useGameStore.getState().syncState({ gameStatus: 'playing' });
        }
      }
    };
    initRoom();

    // Subscribe to state updates via realtime
    let gameChannel: any = null;
    if (roomId !== 'local') {
      gameChannel = insforge.channel(`game_${roomId}`, { config: { broadcast: { self: true, ack: true } } })
        .on('broadcast', { event: 'SYNC_STATE' }, (payload) => {
          if (payload.payload) {
            useGameStore.getState().syncState(payload.payload as Partial<GameState>);
          }
        })
        .subscribe();
    }

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
      if (gameChannel) insforge.removeChannel(gameChannel);
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

  const handleCopy = async () => {
    if (!roomCode) return;
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!roomCode) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?j=${btoa(roomCode)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!playerColor || !userId) return <div className="p-8 flex items-center justify-center h-screen bg-[var(--bg-primary)]">Loading Room...</div>;

  const state = useGameStore.getState();
  const isBotTurn = state.bots[currentTurn];

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden flex flex-col md:flex-row bg-[var(--bg-primary)] overscroll-none">
      
      {isExpired && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-surface-dark/80 backdrop-blur-sm">
          <div className="feature-card p-8 flex flex-col items-center gap-6 max-w-sm text-center shadow-2xl scale-105 transition-transform animate-in zoom-in duration-300">
            <h2 className="text-[28px] font-bold text-red-500">Room Expired</h2>
            <p className="text-body">The 30-minute time limit for this room has ended.</p>
            <button 
              onClick={() => navigate('/')}
              className="btn-primary w-full"
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

        <div className="feature-card flex flex-col gap-4 md:flex-col md:items-start md:gap-4">
          <div className="w-full flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted uppercase font-semibold tracking-widest">Room Code</span>
              <div className="font-mono text-lg tracking-wider break-all bg-surface-strong px-2 py-1 rounded mt-0.5 border border-hairline-strong">
                {roomId === 'local' ? 'Local Mode' : (roomCode || roomId?.substring(0, 8))}
              </div>
            </div>
            {roomId !== 'local' && (
              <div className="flex gap-2">
                <button 
                  onClick={handleCopy} 
                  className="p-1.5 rounded bg-surface-strong hover:bg-hairline-strong transition-colors" 
                  title="Copy Code"
                >
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-ink" />}
                </button>
                <button 
                  onClick={handleShare} 
                  className="p-1.5 rounded bg-surface-strong hover:bg-hairline-strong transition-colors" 
                  title="Copy Invite Link"
                >
                  <Share2 size={16} className="text-ink" />
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-[14px] mt-1 text-body">
              Playing as <span className={`font-bold text-${playerColor}-500 capitalize`}>{colorNames[playerColor] || playerColor}</span>
            </p>
          </div>
          <button 
            onClick={() => {
              useGameStore.getState().resetGame();
              navigate('/');
            }}
            className="btn-secondary w-full md:w-auto text-center mt-2 border-red-200 text-red-500 hover:bg-red-50"
          >
            Leave
          </button>
        </div>

        <div className="feature-card hidden md:block">
           <h3 className="font-bold mb-2 text-[11px] uppercase tracking-widest text-muted">Current Turn</h3>
           <div className={`text-2xl font-bold capitalize text-${currentTurn}-500 flex items-center gap-2`}>
             {currentTurn} 
             {isBotTurn && <span className="text-[10px] bg-surface-dark text-on-dark px-2 py-0.5 rounded-pill uppercase">Bot</span>}
           </div>
        </div>
      </div>

      {/* Center Board */}
      <div className="flex-1 w-full h-full min-w-0 min-h-0 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden relative">
        {state.gameStatus === 'waiting' && roomId !== 'local' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[var(--bg-canvas)]/80 backdrop-blur-sm">
            <div className="feature-card text-center p-8 max-w-sm">
              <h2 className="text-2xl font-bold mb-2 text-ink">Waiting for players...</h2>
              <p className="text-body text-sm mb-4">Share the room code for others to join.</p>
              <div className="font-mono text-xl font-bold bg-surface-strong px-4 py-2 rounded border border-hairline-strong mb-6">
                {roomCode}
              </div>
            </div>
          </div>
        )}
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
        className="md:hidden fixed bottom-6 right-6 p-4 rounded-full bg-primary text-on-primary shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-40 hover:scale-105 transition-transform"
      >
        <MessageSquare size={24} />
      </button>

    </div>
  );
};
