import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, Send, Sparkles, CheckCircle, 
  ArrowRight, Loader2, MessageSquare, Rocket,
  User, Clock, Users, Target, Code, Wallet
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx } from '../lib/utils';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SessionState {
  sessionId: string | null;
  stage: 'idle' | 'interviewing' | 'ready' | 'completed';
  messages: Message[];
  isLoading: boolean;
  projectCreated: boolean;
  projectId?: string;
  jobId?: string;
}

const SUGGESTED_STARTS = [
  { icon: Target, text: "I need a task management app", color: "bg-emerald-500/20 text-emerald-400" },
  { icon: Users, text: "I want to build a social platform", color: "bg-violet-500/20 text-violet-400" },
  { icon: Code, text: "Create an API for my service", color: "bg-blue-500/20 text-blue-400" },
  { icon: Wallet, text: "Build an e-commerce store", color: "bg-amber-500/20 text-amber-400" },
];

export function Receptionist() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    stage: 'idle',
    messages: [],
    isLoading: false,
    projectCreated: false,
  });
  const [input, setInput] = useState('');

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  useEffect(() => {
    // Focus input when session starts
    if (state.sessionId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startSession = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await api.receptionist.startSession();
      setState({
        sessionId: response.sessionId,
        stage: response.stage,
        messages: [{ role: 'assistant', content: response.message }],
        isLoading: false,
        projectCreated: false,
      });
    } catch (err) {
      showToast('Failed to start session', 'error');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const sendMessage = async (messageText: string = input) => {
    if (!messageText.trim() || !state.sessionId || state.isLoading) return;
    
    const text = messageText.trim();
    setInput('');
    
    // Optimistically add user message
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: text }],
      isLoading: true,
    }));

    try {
      const response = await api.receptionist.chat(state.sessionId, text);
      
      setState(prev => ({
        ...prev,
        stage: response.stage,
        messages: [...prev.messages, { role: 'assistant', content: response.message }],
        isLoading: false,
        projectCreated: response.projectCreated,
        projectId: response.projectId,
        jobId: response.jobId,
      }));

      if (response.projectCreated) {
        showToast('🚀 Project created and pipeline started!', 'success');
      }
    } catch (err) {
      showToast('Failed to send message', 'error');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickStart = (text: string) => {
    if (state.stage === 'idle') {
      startSession().then(() => {
        setTimeout(() => sendMessage(text), 500);
      });
    } else {
      sendMessage(text);
    }
  };

  const goToPipeline = () => {
    if (state.jobId) {
      navigate(`/pipeline?job=${state.jobId}`);
    }
  };

  const goToProject = () => {
    if (state.projectId) {
      navigate(`/projects/${state.projectId}`);
    }
  };

  // Idle state - Show welcome screen
  if (state.stage === 'idle') {
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 mb-6">
            <Bot size={40} className="text-violet-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            AI Project Receptionist
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Skip the forms. Just tell me what you want to build, and I'll gather everything 
            your engineering team needs. No technical knowledge required!
          </p>
        </div>

        {/* Quick Start Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {SUGGESTED_STARTS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickStart(item.text)}
              className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 rounded-xl transition-all group text-left"
            >
              <div className={cx("w-12 h-12 rounded-lg flex items-center justify-center", item.color)}>
                <item.icon size={24} />
              </div>
              <div>
                <p className="text-white font-medium group-hover:text-violet-400 transition-colors">
                  {item.text}
                </p>
                <p className="text-sm text-gray-500">Click to start</p>
              </div>
              <ArrowRight size={20} className="ml-auto text-gray-600 group-hover:text-violet-400 transition-colors" />
            </button>
          ))}
        </div>

        {/* Start Button */}
        <div className="text-center">
          <Button 
            size="lg" 
            onClick={startSession}
            disabled={state.isLoading}
            className="gap-2 text-lg px-8"
          >
            {state.isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <MessageSquare size={20} />
                Start Conversation
              </>
            )}
          </Button>
          <p className="text-sm text-gray-500 mt-4">
            Or type your own idea above ☝️
          </p>
        </div>

        {/* How it works */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-4 text-lg font-bold">1</div>
            <h3 className="font-semibold mb-2">Tell Me Your Idea</h3>
            <p className="text-sm text-gray-400">Just describe what you want in plain English. I'll ask the right questions.</p>
          </div>
          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-4 text-lg font-bold">2</div>
            <h3 className="font-semibold mb-2">AI Gathers Requirements</h3>
            <p className="text-sm text-gray-400">I extract features, users, timeline, and tech preferences automatically.</p>
          </div>
          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mx-auto mb-4 text-lg font-bold">3</div>
            <h3 className="font-semibold mb-2">Pipeline Starts</h3>
            <p className="text-sm text-gray-400">Project created, AI agents assigned, development begins immediately!</p>
          </div>
        </div>
      </div>
    );
  }

  // Active conversation
  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center">
            <Bot size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="font-semibold text-white">AI Receptionist</h1>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              {state.stage === 'completed' ? (
                <><CheckCircle size={12} className="text-emerald-400" /> Project Created</>
              ) : state.stage === 'ready' ? (
                <><Sparkles size={12} className="text-amber-400" /> Ready to create</>
              ) : (
                <><Clock size={12} className="text-blue-400" /> Interviewing...</>
              )}
            </p>
          </div>
        </div>
        
        {state.projectCreated && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={goToProject}>
              View Project
            </Button>
            <Button size="sm" onClick={goToPipeline} className="gap-1">
              <Rocket size={14} />
              View Pipeline
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 bg-[#12121a] border border-white/10 rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {state.messages.map((msg, idx) => (
            <div 
              key={idx}
              className={cx(
                "flex gap-4",
                msg.role === 'user' ? "flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div className={cx(
                "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center",
                msg.role === 'user' 
                  ? "bg-violet-600/20 text-violet-400" 
                  : "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400"
              )}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              
              {/* Message */}
              <div className={cx(
                "max-w-[80%] rounded-2xl p-4",
                msg.role === 'user'
                  ? "bg-violet-600 text-white rounded-tr-sm"
                  : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
              )}>
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {state.isLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-violet-400" />
                  <span className="text-sm text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!state.projectCreated && (
          <div className="p-4 border-t border-white/10 bg-[#0d0d12]">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                disabled={state.isLoading}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
              />
              <Button 
                onClick={() => sendMessage()}
                disabled={state.isLoading || !input.trim()}
                className="gap-2"
              >
                <Send size={16} />
                Send
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              The AI will ask follow-up questions to understand your project fully.
              {state.stage === 'ready' && ' When ready, say "create it" or "looks good"!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
