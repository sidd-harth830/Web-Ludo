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

    let subscribedChannel: string | null = null;
    
    const handleNewMessage = (payload: any) => {
      if (payload) {
        const msg = payload as ChatMessage;
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    if (roomId !== 'local') {
      const channelName = `chat_${roomId}`;
      insforge.realtime.subscribe(channelName).then(res => {
        if (res.ok) subscribedChannel = channelName;
      });

      insforge.realtime.on('NEW_MESSAGE', handleNewMessage);
    }

    return () => {
      if (subscribedChannel) insforge.realtime.unsubscribe(subscribedChannel);
      insforge.realtime.off('NEW_MESSAGE', handleNewMessage);
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

    if (roomId !== 'local') {
      const { error, data } = await insforge.database.from('chat_messages').insert([newMessage]).select();

      if (!error && data) {
        const inserted = (data as any)?.[0] || newMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === inserted.id)) return prev;
          return [...prev, inserted as ChatMessage];
        });
        insforge.realtime.publish(`chat_${roomId}`, 'NEW_MESSAGE', inserted).catch(console.error);
      } else {
        // Revert if error
        setInput(tempInput);
      }
    } else {
      // Local Mode: just set it locally with a fake ID
      const localMsg = { ...newMessage, id: Date.now().toString(), created_at: new Date().toISOString() };
      setMessages(prev => [...prev, localMsg as ChatMessage]);
    }
  };

  return (
    <div className="bg-surface-card border border-hairline-strong rounded-xl flex flex-col h-full w-full overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="bg-surface-strong/30 border-b border-hairline-strong p-3 flex justify-between items-center font-semibold text-sm">
        <span className="text-ink">Live Chat</span>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-surface-strong transition-colors">
            <X size={18} className="text-muted" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-canvas-soft">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted mt-4">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.user_id === userId ? 'items-end' : 'items-start'} mb-1`}>
            {m.user_id !== userId && (
              <span className="text-[10px] font-bold text-muted mb-0.5 ml-1">
                {userMap[m.user_id] || 'Unknown Player'}
              </span>
            )}
            <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm shadow-sm ${
              m.user_id === userId 
                ? 'bg-primary text-on-primary rounded-br-sm' 
                : 'bg-surface-card text-ink rounded-bl-sm border border-hairline-strong'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      
      <form onSubmit={sendMessage} className="p-3 border-t border-hairline-strong flex gap-2 bg-surface-card relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRateLimited ? "Slow down..." : "Type a message..."}
          disabled={isRateLimited}
          className={`text-input flex-1 ${isRateLimited ? 'opacity-70' : ''}`}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isRateLimited}
          className="btn-primary w-11 px-0 flex items-center justify-center shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
