import React, { useEffect, useState, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { Send, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export const ChatPanel: React.FC<{ roomId: string; userId: string; userMap: Record<string, string>; onClose?: () => void }> = ({ roomId, userId, userMap, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [lastSentAt, setLastSentAt] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch existing messages
    const fetchMessages = async () => {
      const { data } = await insforge.database
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
    };

    fetchMessages();

    const setupRealtime = async () => {
      await insforge.realtime.connect();
      await insforge.realtime.subscribe(`chat:${roomId}`);
      insforge.realtime.on<{ message: ChatMessage }>('NEW_MESSAGE', (payload) => {
        if (payload && payload.message) {
          const msg = (payload as any).payload?.message || payload.message;
          if (msg) {
            setMessages((prev) => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg as ChatMessage];
            });
          }
        }
      });
    };
    setupRealtime();

    return () => {
      insforge.realtime.unsubscribe(`chat:${roomId}`);
    };
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRateLimited) return;

    const now = Date.now();
    if (now - lastSentAt < 1500) {
      setIsRateLimited(true);
      setTimeout(() => setIsRateLimited(false), 1500 - (now - lastSentAt));
      return;
    }
    
    setLastSentAt(now);

    const newMessage = {
      room_id: roomId,
      user_id: userId,
      content: input.trim(),
    };

    const tempInput = input.trim();
    setInput(''); // Clear immediately for UX

    const { error, data } = await insforge.database.from('chat_messages').insert([newMessage]).select();

    if (!error && data) {
      const inserted = (data as any)?.[0] || newMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === inserted.id)) return prev;
        return [...prev, inserted as ChatMessage];
      });
      insforge.realtime.publish(`chat:${roomId}`, 'NEW_MESSAGE', { message: inserted });
    } else {
      // Revert if error
      setInput(tempInput);
    }
  };

  return (
    <div className="glass-panel flex flex-col h-full w-full overflow-hidden shadow-2xl">
      <div className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 p-3 flex justify-between items-center font-semibold text-sm">
        <span className="text-slate-800 dark:text-slate-200">Live Chat</span>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <X size={18} className="text-slate-600 dark:text-slate-400" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/30 dark:bg-black/10">
        {messages.length === 0 && (
          <div className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.user_id === userId ? 'items-end' : 'items-start'} mb-1`}>
            {m.user_id !== userId && (
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 ml-1">
                {userMap[m.user_id] || 'Unknown Player'}
              </span>
            )}
            <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm shadow-sm ${
              m.user_id === userId 
                ? 'bg-blue-500 text-white rounded-br-sm' 
                : 'bg-white dark:bg-white/10 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-100 dark:border-white/5'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      
      <form onSubmit={sendMessage} className="p-3 border-t border-slate-200 dark:border-white/10 flex gap-2 bg-slate-50/50 dark:bg-white/5 relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRateLimited ? "Slow down..." : "Type a message..."}
          disabled={isRateLimited}
          className={`flex-1 bg-white dark:bg-black/20 border ${isRateLimited ? 'border-red-300 dark:border-red-500/50 opacity-70' : 'border-slate-300 dark:border-white/10'} rounded-md px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner`}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isRateLimited}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 p-2 rounded-md transition-colors text-white shadow-sm"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
