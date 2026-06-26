import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { insforge } from '../lib/insforge';
import type { PlayerColor } from '../store/gameStore';
import { Bot, User } from 'lucide-react';

const COLORS: PlayerColor[] = ['emerald', 'blue', 'red', 'amber'];

export const Home: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [bots, setBots] = useState<Record<PlayerColor, boolean>>({
    emerald: false, blue: false, red: false, amber: false
  });
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const initInvite = async () => {
      const savedName = localStorage.getItem('ludo_username');
      if (savedName) setUsername(savedName);

      const encodedCode = searchParams.get('j');
      const queryCode = searchParams.get('code');
      
      let targetCode = '';
      if (encodedCode) {
        try {
          targetCode = atob(encodedCode);
        } catch (e) {
          // ignore invalid base64
        }
      } else if (queryCode) {
        targetCode = queryCode;
      }

      if (targetCode) {
        setCode(targetCode);
        setActiveTab('join');
        
        if (savedName) {
          await performJoinOrCreate(targetCode, savedName, 'join');
        } else {
          setInviteModalOpen(true);
        }
      }
    };
    initInvite();
  }, [searchParams]);

  const toggleBot = (color: PlayerColor) => {
    setBots(prev => ({ ...prev, [color]: !prev[color] }));
  };

  const generateComplexCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${result.slice(0,4)}-${result.slice(4,8)}-${result.slice(8,12)}`;
  };

  const performJoinOrCreate = async (roomCodeArg: string, usernameArg: string, tab: 'join' | 'host') => {
    setLoading(true);
    let roomCode = tab === 'join' ? roomCodeArg.trim().toUpperCase() : generateComplexCode();
    
    import('../store/gameStore').then(({ useGameStore }) => {
      useGameStore.getState().resetGame();
    });

    try {
      let userId: string;
      const { data: users } = await insforge.database.from('users').select('id').eq('username', usernameArg).maybeSingle();
      
      if (users) {
        userId = (users as any).id;
      } else {
        const { data: newUser, error: userError } = await insforge.database.from('users').insert([{ username: usernameArg }]).select('id').single();
        if (userError) throw userError;
        userId = (newUser as any).id;
      }

      localStorage.setItem('ludo_user_id', userId);
      localStorage.setItem('ludo_username', usernameArg);

      let roomId: string;
      if (tab === 'host') {
        const activeColors = COLORS.slice(0, playerCount);
        const isAllBots = activeColors.slice(1).every(c => bots[c]);

        if (isAllBots) {
          roomId = 'local';
          import('../store/gameStore').then(({ useGameStore }) => {
            useGameStore.getState().initGameConfig(playerCount, bots);
          });
        } else {
          const gameState = { playerCount, bots };
          const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();

          const { data: newRoom, error: roomError } = await insforge.database
            .from('rooms')
            .insert([{ code: roomCode, state: gameState, expires_at: expiresAt }])
            .select('id').single();
            
          if (roomError) throw roomError;
          roomId = (newRoom as any).id;
          
          await insforge.database.from('room_players').insert([{ room_id: roomId, user_id: userId, color: 'emerald', is_host: true }]);
        }
      } else {
        const { data: existingRoom } = await insforge.database.from('rooms').select('id').eq('code', roomCode).maybeSingle();
        if (!existingRoom) throw new Error('Room not found');
        roomId = (existingRoom as any).id;
        
        const { data: players } = await insforge.database.from('room_players').select('color, user_id').eq('room_id', roomId);
        const existingPlayer = (players as any[])?.find(p => p.user_id === userId);

        if (!existingPlayer) {
          const usedColors = (players as any[])?.map(p => p.color) || [];
          
          const { data: roomData } = await insforge.database.from('rooms').select('state, status').eq('id', roomId).single();
          if ((roomData as any).status === 'expired') throw new Error('Room has expired');
          const roomState = (roomData as any).state || {};
          const roomBots = roomState.bots || {};
          const activePlayersCount = roomState.playerCount || 4;
          
          const activeColors = COLORS.slice(0, activePlayersCount);
          const availableColors = activeColors.filter(c => !usedColors.includes(c) && !roomBots[c]);
          
          if (availableColors.length === 0) throw new Error('Room is full');
          
          await insforge.database.from('room_players').upsert(
            [{ room_id: roomId, user_id: userId, color: availableColors[0], is_host: false }],
            { onConflict: 'room_id,user_id' }
          );
        }
      }

      navigate(`/room/${roomId}`);
    } catch (err: any) {
      alert(err.message || 'Error joining room');
      setLoading(false);
    }
  };

  const handleJoinOrCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return alert('Please enter a username');
    if (activeTab === 'join' && !code.trim()) return alert('Please enter a room code');
    await performJoinOrCreate(code, username, activeTab);
  };

  const activeColors = COLORS.slice(0, playerCount);

  if (inviteModalOpen) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm fixed inset-0 z-50">
        <div className="glass-panel w-full max-w-sm bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl animate-in zoom-in-95 duration-200">
          <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50 mb-2">You've been invited!</h2>
          <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm mb-6">Enter a username to join the game.</p>
          
          <form onSubmit={(e) => { e.preventDefault(); if (username.trim()) performJoinOrCreate(code, username, 'join'); }} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1.5 uppercase tracking-widest">Username</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="text-input"
                placeholder="Enter your name"
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !username.trim()}
              className="btn-primary mt-2"
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
            <button 
              type="button"
              onClick={() => { setInviteModalOpen(false); navigate('/'); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[var(--bg-canvas)] relative">
      {/* Sky wash gradient background for hero */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-[var(--gradient-sky-light,#cfe7ff)] to-[var(--gradient-sky-mid,#a8c8e8)] opacity-20 pointer-events-none -z-10 dark:opacity-0" />
      
      <div className="mb-12 text-center relative z-10">
        <h1 className="text-[64px] leading-[1.05] tracking-[-1.92px] font-semibold text-ink mb-4">Web Ludo</h1>
        <p className="text-[18px] text-body">Multiplayer Board Game Platform</p>
      </div>

      <div className="feature-card w-full max-w-md p-0 overflow-hidden relative z-10">
        {/* Tabs */}
        <div className="flex border-b border-hairline-strong">
          <button
            type="button"
            className={`flex-1 py-4 text-[14px] font-medium transition-colors ${activeTab === 'join' ? 'text-ink border-b-2 border-primary bg-surface-strong/30' : 'text-body hover:text-ink hover:bg-surface-strong/10'}`}
            onClick={() => setActiveTab('join')}
          >
            Join Game
          </button>
          <button
            type="button"
            className={`flex-1 py-4 text-[14px] font-medium transition-colors ${activeTab === 'host' ? 'text-ink border-b-2 border-primary bg-surface-strong/30' : 'text-body hover:text-ink hover:bg-surface-strong/10'}`}
            onClick={() => setActiveTab('host')}
          >
            Host Game
          </button>
        </div>

        <form onSubmit={handleJoinOrCreate} className="p-6 flex flex-col gap-6">
          <div className="space-y-4">
            {/* Username Input - Shared */}
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1.5 uppercase tracking-widest">Username</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="text-input"
                placeholder="Enter your name"
              />
            </div>
            
            {/* Join Room Specific */}
            {activeTab === 'join' && (
              <div>
                <label className="block text-[11px] font-semibold text-ink mb-1.5 uppercase tracking-widest">Room Code</label>
                <input 
                  type="text" 
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-input uppercase font-mono"
                  placeholder="e.g. A1B2-C3D4-E5F6"
                />
              </div>
            )}
          </div>

          {/* Host Room Specific */}
          {activeTab === 'host' && (
            <div className="space-y-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              
              {/* Segmented Control for Players */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">Total Players</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {[2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPlayerCount(num)}
                      className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                        playerCount === num 
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm border border-zinc-200 dark:border-zinc-700' 
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slot Setup */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">Slot Configuration</label>
                <div className="flex flex-col gap-2">
                  {activeColors.map((color, idx) => (
                    <div key={color} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-${color}-500 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]`} />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {idx === 0 ? 'Host (You)' : `Player ${idx+1}`}
                        </span>
                      </div>
                      
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleBot(color)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border ${
                            bots[color] 
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100' 
                              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {bots[color] ? (
                            <><Bot size={14} /> AI Bot</>
                          ) : (
                            <><User size={14} /> Human</>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Processing...' : (activeTab === 'join' ? 'Join Room' : 'Create Game')}
          </button>
        </form>
      </div>
    </div>
  );
};
