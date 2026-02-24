import { useEffect, useState, useRef } from 'react';
import { BrainCircuit, PlayCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx } from '../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  createdAt?: string;
}

export function Chat() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const data = await api.getChatMessages();
      setMessages(data.messages || []);
    } catch (err) {
      // Silent fail - chat might be empty
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);

    try {
      const response = await api.sendChatMessage(userMessage);
      // Reload messages to get the AI response
      await loadMessages();
    } catch (err) {
      showToast('Failed to send message', 'error');
      // Remove optimistic message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await api.clearChat();
      setMessages([]);
      showToast('Chat cleared');
    } catch (err) {
      showToast('Failed to clear chat', 'error');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-[#1a1a24] rounded-xl border border-white/10 shadow-lg overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-[#12121a] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center border border-violet-500/30">
            <BrainCircuit size={16} className="text-violet-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">Orchestrator Chat</h2>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> Online
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear}>Clear History</Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <BrainCircuit size={48} className="mx-auto mb-4 opacity-20" />
            <p>Start a conversation with the GM7 Orchestrator</p>
            <p className="text-sm mt-2">Ask about projects, jobs, or request pipeline actions</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cx(
                "flex",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cx(
                "max-w-[80%] rounded-2xl p-4 text-sm shadow-sm",
                msg.role === 'user' 
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm" 
                  : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 text-gray-200 rounded-2xl rounded-tl-sm p-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#12121a] border-t border-white/10">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask GM7 to create a project, check status..."
            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-violet-400 hover:text-violet-300 transition-colors bg-violet-500/10 rounded-lg hover:bg-violet-500/20 disabled:opacity-50"
          >
            <PlayCircle size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
