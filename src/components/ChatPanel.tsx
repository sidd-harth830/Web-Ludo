import React, { useEffect, useState, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { Send, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { socket } from '../lib/socket';

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export const ChatPanel: React.FC<{ roomId: string; userId: string; userMap: Record<string, string>; onClose?: () => void }> = ({ roomId, userId, userMap, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const { isSocketConnected } = useGameStore();
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
    
    const handleNewMessage = (msg: any) => {
      if (msg) {
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg as ChatMessage];
        });
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
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const QUICK_MESSAGES = ["Hello!", "Good luck!", "Nice move!", "Oops!", "Hurry up!", "Well played!", "Wow!"];

  const sendTextMessage = (text: string) => {
    if (!text.trim() || isRateLimited || (!isSocketConnected && roomId !== 'local')) return;

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
      content: text.trim(),
    };

    if (roomId !== 'local') {
      const optimisticMsg = { ...newMessage, id: Date.now().toString(), created_at: new Date().toISOString() };
      
      setMessages(prev => [...prev, optimisticMsg as ChatMessage]);
      socket.emit('SEND_CHAT', roomId, optimisticMsg);

      // Fire and forget
      insforge.database.from('chat_messages').insert([newMessage]).then();
    } else {
      // Local Mode: just set it locally with a fake ID
      const localMsg = { ...newMessage, id: Date.now().toString(), created_at: new Date().toISOString() };
      setMessages(prev => [...prev, localMsg as ChatMessage]);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const textToSubmit = input;
    setInput(''); // Clear immediately for UX
    sendTextMessage(textToSubmit);
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
      
      <div className="px-3 py-2 bg-surface-card flex gap-2 overflow-x-auto no-scrollbar border-t border-hairline-strong shadow-sm relative z-10">
        {QUICK_MESSAGES.map((msg, i) => (
          <button 
            key={i} 
            type="button"
            onClick={() => sendTextMessage(msg)}
            disabled={isRateLimited || (!isSocketConnected && roomId !== 'local')}
            className="whitespace-nowrap px-3 py-1 bg-surface-strong/50 hover:bg-surface-strong rounded-full text-xs font-medium text-ink transition-colors disabled:opacity-50"
          >
            {msg}
          </button>
        ))}
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-hairline-strong flex gap-2 bg-surface-card relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRateLimited ? "Slow down..." : "Type a message..."}
          disabled={isRateLimited || (!isSocketConnected && roomId !== 'local')}
          className="text-input flex-1 disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isRateLimited || (!isSocketConnected && roomId !== 'local')}
          className="btn-primary w-11 px-0 flex items-center justify-center shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
