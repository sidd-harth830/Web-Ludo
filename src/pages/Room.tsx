import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { insforge } from '../lib/insforge';
import { GameBoard } from '../components/GameBoard';
import { ChatPanel } from '../components/ChatPanel';
import { useGameStore } from '../store/gameStore';
import type { PlayerColor, GameState } from '../store/gameStore';
import { MessageSquare, Clock, Copy, Share2, Check, Trophy } from 'lucide-react';
import { socket } from '../lib/socket';

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { currentTurn, tokens, diceRoll, gameStatus, points } = useGameStore();
  const botWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem('ludo_user_id');
    if (!storedUserId || !roomId) {
      navigate('/');
      return;
    }
    setUserId(storedUserId);
    useGameStore.getState().forceSyncState({ roomId });

    const initRoom = async () => {
      if (roomId === 'local') {
        setRoomCode('LOCAL');
        setIsHost(true);
        setPlayerColor('emerald');
        const colors = ['emerald', 'blue', 'red', 'amber'];
        const cNames: Record<string, string> = {};
        colors.forEach(c => {
          cNames[c] = c === 'emerald' ? 'You' : 'Bot';
        });
        setColorNames(cNames);
        useGameStore.getState().forceSyncState({ gameStatus: 'playing' });
        return;
      }

      let roomConfig = { playerCount: 4, bots: { emerald: false, blue: false, red: false, amber: false } };
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
        const stateObj = (roomData as any).state || {};
        if (stateObj.playerCount) roomConfig.playerCount = stateObj.playerCount;
        if (stateObj.bots) roomConfig.bots = stateObj.bots;
      }

      // Fetch player info & usernames
      const { data: players } = await insforge.database
        .from('room_players')
        .select('color, user_id, is_host, users(username)')
        .eq('room_id', roomId);
      
      let pColor: PlayerColor = 'emerald';
      let uName = localStorage.getItem('ludo_username') || 'Unknown';

      if (players) {
        const pNames: Record<string, string> = {};
        const cNames: Record<string, string> = {};
        
        players.forEach((p: any) => {
          const uname = p.users?.username || 'Unknown';
          pNames[p.user_id] = uname;
          cNames[p.color] = uname;
          if (p.user_id === storedUserId) {
            setPlayerColor(p.color as PlayerColor);
            pColor = p.color as PlayerColor;
            if (p.is_host) setIsHost(true);
          }
        });
        setPlayerNames(pNames);
        setColorNames(cNames);
      }

      if (roomId !== 'local') {
        socket.connect();
        
        socket.on('connect', () => {
          useGameStore.getState().setSocketConnected(true);
          socket.emit('JOIN_ROOM', roomId, { username: uName, color: pColor }, roomConfig);
        });

        socket.on('STATE_UPDATE', (newState: GameState) => {
          useGameStore.getState().forceSyncState(newState);
        });

        socket.on('disconnect', () => {
          useGameStore.getState().setSocketConnected(false);
        });

        socket.on('PLAYER_LEFT', (username: string) => {
          setToastMessage(`${username} left the game!`);
          setTimeout(() => setToastMessage(null), 3000);
        });
      }
    };
    initRoom();

    const handleBeforeUnload = () => {
      // Disconnect immediately on unload
      if (roomId !== 'local') {
        socket.disconnect();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Setup Bot Worker
    botWorkerRef.current = new Worker(new URL('../workers/botWorker.ts', import.meta.url), { type: 'module' });
    botWorkerRef.current.onmessage = (e) => {
      if (e.data.type === 'MOVE_RESULT') {
        const turn = useGameStore.getState().currentTurn;
        if (e.data.tokenId !== null) {
          socket.emit('REQUEST_MOVE', roomId, e.data.tokenId, turn);
        }
      }
    };

    return () => {
      useGameStore.getState().setSocketConnected(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (roomId !== 'local') {
        socket.off('STATE_UPDATE');
        socket.off('connect');
        socket.off('disconnect');
        socket.disconnect();
      }
      botWorkerRef.current?.terminate();
    };
  }, [roomId, navigate]);

  // Unread Messages Listener
  useEffect(() => {
    const handleNewMessage = () => {
      if (!showChat && window.innerWidth < 768) {
        setUnreadCount(prev => prev + 1);
      }
    };
    if (roomId !== 'local') {
      socket.on('NEW_CHAT', handleNewMessage);
    }
    return () => {
      if (roomId !== 'local') {
        socket.off('NEW_CHAT', handleNewMessage);
      }
    };
  }, [roomId, showChat]);

  // Reset unread when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

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

    // Also force re-render for turn progress bar
    const progressInterval = setInterval(() => {
      if (useGameStore.getState().gameStatus === 'playing') {
        setTimeLeft(prev => prev); // dummy state update to force re-render of progress bar
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [expiresAt, isExpired, isHost, roomId]);

  // Bot logic trigger
  useEffect(() => {
    if (!isHost || !botWorkerRef.current || !roomId || isExpired) return;
    
    const state = useGameStore.getState();
    if (!state.bots[currentTurn]) return;

    if (diceRoll === null && !state.hasRolled) {
      // Roll the dice for the bot
      const timer = setTimeout(() => {
        socket.emit('REQUEST_ROLL', roomId);
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

// ... (in Room component)
  const isFinished = state.gameStatus === 'finished';
  const hasWinners = state.winners && state.winners.length > 0;

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden flex flex-col md:flex-row bg-[var(--bg-primary)] overscroll-none">
      {hasWinners && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={isFinished} />}

      {(isFinished || hasWinners) && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none">
          <div className="feature-card p-10 flex flex-col items-center gap-6 max-w-sm text-center shadow-[0_0_50px_rgba(234,179,8,0.2)] scale-105 transition-transform pointer-events-auto mt-[-10%] border-amber-500/30">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-30 rounded-full animate-pulse-slow"></div>
              <Trophy className="text-yellow-500 w-20 h-20 relative z-10 animate-float" />
            </div>
            <h2 className="text-[32px] font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-amber-600">
               {isFinished ? "Game Over!" : "We have a winner!"}
            </h2>
            <div className="flex flex-col gap-3 w-full text-left max-h-64 overflow-y-auto pr-2">
              {state.winners.map((winner: any, index: number) => (
                <div key={winner} className={`p-3 rounded-lg flex items-center justify-between border-2 border-${winner}-500 bg-${winner}-500/10`}>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg capitalize">{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Place</span>
                    <span className={`text-${winner}-500 font-bold capitalize`}>{colorNames[winner] || winner}</span>
                  </div>
                  <span className="text-xl font-bold bg-surface-dark text-on-dark px-3 py-1 rounded-full">{points[winner as PlayerColor]} pts</span>
                </div>
              ))}
            </div>
            {isFinished && (
              <button onClick={() => navigate('/')} className="btn-primary w-full mt-4">
                Play Again
              </button>
            )}
          </div>
        </div>
      )}

      {isExpired && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="feature-card p-10 flex flex-col items-center gap-6 max-w-sm text-center shadow-[0_0_50px_rgba(239,68,68,0.2)] border-red-500/30 scale-105 transition-transform animate-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <Clock className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-[32px] font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-red-600">Room Expired</h2>
            <p className="text-body text-lg">The 30-minute time limit for this room has ended.</p>
            <button 
              onClick={() => navigate('/')}
              className="btn-primary w-full"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top fade-in duration-300">
          <div className="bg-surface-dark text-on-dark px-6 py-3 rounded-full shadow-2xl border border-hairline-strong font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {toastMessage}
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
              if (roomId !== 'local') socket.disconnect();
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
           <div className={`text-2xl font-bold capitalize text-${currentTurn}-500 flex items-center gap-2 mb-2`}>
             {currentTurn} 
             {isBotTurn && <span className="text-[10px] bg-surface-dark text-on-dark px-2 py-0.5 rounded-pill uppercase">Bot</span>}
           </div>
           {state.turnEndTime > 0 && gameStatus === 'playing' && (
             <div className="w-full h-1.5 bg-surface-dark rounded-full overflow-hidden">
               <div 
                 className={`h-full bg-${currentTurn}-500 transition-all duration-1000 ease-linear`}
                 style={{ width: `${Math.max(0, Math.min(100, ((state.turnEndTime - Date.now()) / 15000) * 100))}%` }}
               />
             </div>
           )}
        </div>

        <div className="feature-card hidden md:block">
           <h3 className="font-bold mb-2 text-[11px] uppercase tracking-widest text-muted">Scoreboard</h3>
           <div className="flex flex-col gap-2">
             {['emerald', 'blue', 'red', 'amber'].slice(0, state.playerCount).map(c => (
               <div key={c} className={`flex justify-between items-center text-sm font-bold ${c === currentTurn ? `text-${c}-500` : 'text-muted'}`}>
                 <span className="capitalize">{colorNames[c] || c}</span>
                 <span className="bg-surface-dark text-on-dark px-2 py-0.5 rounded">{points[c as PlayerColor] || 0}</span>
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Center Board */}
      <div className="flex-1 w-full h-full min-w-0 min-h-0 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden relative">
        {gameStatus === 'waiting' && roomId !== 'local' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md">
            <div className="feature-card text-center p-10 max-w-sm border-t-4 border-t-primary shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(255,255,255,0.05)] animate-float">
              <div className="w-16 h-16 rounded-full bg-primary/5 dark:bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-pulse-slow">
                <Clock className="text-primary w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-ink">Waiting for players...</h2>
              <p className="text-body text-sm mb-8">Share the room code for others to join.</p>
              <div className="font-mono text-xl font-bold bg-surface-strong px-6 py-4 rounded-xl border border-hairline-strong shadow-inner">
                {roomCode}
              </div>
            </div>
          </div>
        )}
        {gameStatus === 'paused' && roomId !== 'local' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-900/80 dark:bg-zinc-100/10 backdrop-blur-md">
            <div className="feature-card text-center p-8 max-w-sm bg-zinc-900 border border-zinc-800 dark:bg-zinc-100 dark:border-zinc-200">
              <h2 className="text-2xl font-bold mb-2 text-zinc-100 dark:text-zinc-900">Game Paused</h2>
              <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-4">A player disconnected. Waiting for a replacement or for them to rejoin...</p>
              <div className="font-mono text-xl font-bold bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900 px-4 py-2 rounded border border-zinc-700 dark:border-zinc-300 mb-6">
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
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[var(--bg-primary)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

    </div>
  );
};
