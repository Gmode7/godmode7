import { useEffect, useState, useRef } from 'react';
import { BrainCircuit, PlayCircle, Sparkles, Zap, Lightbulb } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx } from '../lib/utils';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

const QUICK_ACTIONS = [
  { label: 'Build Todo App', icon: Sparkles, prompt: 'build a todo app' },
  { label: 'Build Chat App', icon: Zap, prompt: 'build a chat app' },
  { label: 'Check Status', icon: Lightbulb, prompt: 'status' },
];

export function Chat() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    // Auto-refresh every 5 seconds to see pipeline updates
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
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

  const handleSend = async (e?: React.FormEvent, quickPrompt?: string) => {
    e?.preventDefault();
    
    const messageText = quickPrompt || input.trim();
    if (!messageText || loading) return;

    setInput('');
    setLoading(true);

    // Optimistically add user message
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      role: 'user', 
      content: messageText 
    }]);

    try {
      await api.sendChatMessage(messageText);
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
            <h2 className="font-semibold text-white text-sm">AI Assistant</h2>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> Ready to build
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear}>Clear</Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <BrainCircuit size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-400 mb-2">What should we build today?</p>
            <p className="text-sm mb-6">Just type naturally - "build a todo app" or "create a blog"</p>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(undefined, action.prompt)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-lg text-sm text-violet-300 transition-colors"
                >
                  <action.icon size={14} />
                  {action.label}
                </button>
              ))}
            </div>
            
            <div className="mt-8 p-4 bg-white/5 rounded-lg text-left max-w-md mx-auto">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Examples you can try:</p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• "build a todo list app"</li>
                <li>• "create a chat application"</li>
                <li>• "I need a blog website"</li>
                <li>• "make a note-taking app"</li>
                <li>• "help" - see all commands</li>
              </ul>
            </div>
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
                "max-w-[85%] rounded-2xl p-4 shadow-sm",
                msg.role === 'user' 
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm" 
                  : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
              )}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 text-gray-200 rounded-2xl rounded-tl-sm p-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="ml-2 text-sm text-gray-400">AI is thinking...</span>
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
            placeholder="Try: build a todo app..."
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
        <p className="text-xs text-gray-500 mt-2 text-center">
          Type naturally or try: "build a chat app" • "status" • "help"
        </p>
      </div>
    </div>
  );
}
