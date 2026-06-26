import React, { useEffect, useState } from 'react';
import { insforge } from '../lib/insforge';
import { useNavigate } from 'react-router-dom';

interface Analytics {
  totalUsers: number;
  activeRooms: number;
  totalMessages: number;
}

export const Admin: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics>({ totalUsers: 0, activeRooms: 0, totalMessages: 0 });
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const fetchAnalytics = async () => {
    try {
      const { count: userCount } = await insforge.database.from('users').select('*', { count: 'exact', head: true });
      const { count: roomCount } = await insforge.database.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'playing');
      const { count: messageCount } = await insforge.database.from('chat_messages').select('*', { count: 'exact', head: true });
      
      setAnalytics({
        totalUsers: userCount || 0,
        activeRooms: roomCount || 0,
        totalMessages: messageCount || 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth) {
      fetchAnalytics();
      // Simple polling
      const interval = setInterval(fetchAnalytics, 5000);
      return () => clearInterval(interval);
    }
  }, [auth]);

  if (!auth) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <form 
          className="glass-panel p-8 flex flex-col gap-4 z-10 w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (password === 'admin123') setAuth(true); // Super simple auth for prototype
            else alert('Invalid password');
          }}
        >
          <h2 className="text-2xl font-bold mb-2">Admin Access</h2>
          <input 
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
            placeholder="Enter admin password"
          />
          <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg font-bold transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-8 z-10 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">Admin Dashboard</h1>
        <button onClick={() => navigate('/')} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-white/10">
          Back to Home
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 flex flex-col items-center justify-center gap-2">
          <span className="text-slate-400 font-medium">Total Users</span>
          <span className="text-5xl font-bold text-emerald-400">{loading ? '-' : analytics.totalUsers}</span>
        </div>
        <div className="glass-panel p-6 flex flex-col items-center justify-center gap-2">
          <span className="text-slate-400 font-medium">Active Matches</span>
          <span className="text-5xl font-bold text-blue-400">{loading ? '-' : analytics.activeRooms}</span>
        </div>
        <div className="glass-panel p-6 flex flex-col items-center justify-center gap-2">
          <span className="text-slate-400 font-medium">Chat Messages</span>
          <span className="text-5xl font-bold text-amber-400">{loading ? '-' : analytics.totalMessages}</span>
        </div>
      </div>
    </div>
  );
};
