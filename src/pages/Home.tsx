import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { insforge } from '../lib/insforge';
import type { PlayerColor } from '../store/gameStore';
import { Users, Bot, Settings2 } from 'lucide-react';

const COLORS: PlayerColor[] = ['emerald', 'blue', 'red', 'amber'];

export const Home: React.FC = () => {
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [bots, setBots] = useState<Record<PlayerColor, boolean>>({
    emerald: false, blue: false, red: false, amber: false
  });
  
  const navigate = useNavigate();

  const toggleBot = (color: PlayerColor) => {
    setBots(prev => ({ ...prev, [color]: !prev[color] }));
  };

  const handleJoinOrCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return alert('Please enter a username');
    
    setLoading(true);
    let roomCode = code.trim().toUpperCase();
    
    try {
      // 1. Ensure user exists
      let userId: string;
      const { data: users } = await insforge.database.from('users').select('id').eq('username', username).maybeSingle();
      
      if (users) {
        userId = (users as any).id;
      } else {
        const { data: newUser, error: userError } = await insforge.database.from('users').insert([{ username }]).select('id').single();
        if (userError) throw userError;
        userId = (newUser as any).id;
      }

      localStorage.setItem('ludo_user_id', userId);
      localStorage.setItem('ludo_username', username);

      let roomId: string;
      if (!roomCode) {
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const gameState = { playerCount, bots };
        const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();

        const { data: newRoom, error: roomError } = await insforge.database
          .from('rooms')
          .insert([{ code: roomCode, state: gameState, expires_at: expiresAt }])
          .select('id').single();
          
        if (roomError) throw roomError;
        roomId = (newRoom as any).id;
        
        await insforge.database.from('room_players').insert([{ room_id: roomId, user_id: userId, color: 'emerald', is_host: true }]);
      } else {
        const { data: existingRoom } = await insforge.database.from('rooms').select('id').eq('code', roomCode).maybeSingle();
        if (!existingRoom) throw new Error('Room not found');
        roomId = (existingRoom as any).id;
        
        const { data: players } = await insforge.database.from('room_players').select('color').eq('room_id', roomId);
        const usedColors = (players as any[])?.map(p => p.color) || [];
        
        const { data: roomData } = await insforge.database.from('rooms').select('state, status').eq('id', roomId).single();
        if ((roomData as any).status === 'expired') throw new Error('Room has expired');
        const roomState = (roomData as any).state || {};
        const roomBots = roomState.bots || {};
        const activePlayersCount = roomState.playerCount || 4;
        
        const activeColors = COLORS.slice(0, activePlayersCount);
        const availableColors = activeColors.filter(c => !usedColors.includes(c) && !roomBots[c]);
        
        if (availableColors.length === 0) throw new Error('Room is full');
        
        await insforge.database.from('room_players').insert([{ room_id: roomId, user_id: userId, color: availableColors[0], is_host: false }]);
      }

      navigate(`/room/${roomId}`);
    } catch (err: any) {
      alert(err.message || 'Error joining room');
    } finally {
      setLoading(false);
    }
  };

  const activeColors = COLORS.slice(0, playerCount);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 flex flex-col gap-6 relative z-10 transition-all">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-2">Web Ludo</h1>
          <p className="text-slate-500 dark:text-slate-400">Real-time multiplayer board game</p>
        </div>

        <form onSubmit={handleJoinOrCreate} className="flex flex-col gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                placeholder="Enter your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room Code (optional)</label>
              <input 
                type="text" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors uppercase shadow-inner"
                placeholder="Leave blank to create new room"
              />
            </div>
          </div>

          {!code && (
            <div className="bg-white/40 dark:bg-white/5 p-4 rounded-xl border border-slate-200/50 dark:border-white/10 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 size={18} className="text-emerald-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Room Configuration</h3>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Players</label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPlayerCount(num)}
                      className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all ${
                        playerCount === num 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-slate-200/50 dark:bg-black/30 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-black/50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Slot Setup (Bots)</label>
                <div className="grid grid-cols-2 gap-2">
                  {activeColors.map((color, idx) => (
                    <div key={color} className="flex items-center justify-between p-2 rounded bg-slate-100/80 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                      <span className={`text-xs font-bold text-${color}-500 dark:text-${color}-400 capitalize`}>
                        {idx === 0 ? 'You (P1)' : `P${idx+1} (${color})`}
                      </span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleBot(color)}
                          className={`p-1.5 rounded-md transition-colors ${
                            bots[color] 
                              ? 'bg-blue-500 shadow-md text-white' 
                              : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                          }`}
                          title={bots[color] ? "Bot Player" : "Human Player"}
                        >
                          {bots[color] ? <Bot size={14} /> : <Users size={14} />}
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
            className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 disabled:opacity-50 px-4 py-3 rounded-lg font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] text-white"
          >
            {loading ? 'Joining...' : (code ? 'Join Room' : 'Create Game')}
          </button>
        </form>
      </div>
    </div>
  );
};
