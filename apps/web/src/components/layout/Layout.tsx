import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Activity, 
  Bot, 
  MessageSquare, 
  Settings, 
  Menu,
  Bell,
  Command,
  Search,
  BrainCircuit
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { cx } from '../../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  path,
  isActive,
  onClick
}: { 
  icon: any, 
  label: string, 
  path: string,
  isActive: boolean,
  onClick: () => void
}) => {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
        isActive 
          ? "bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-[inset_0_0_10px_rgba(139,92,246,0.1)]" 
          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
      )}
    >
      <Icon size={18} className={cx(isActive ? "text-violet-400" : "text-gray-500")} />
      {label}
    </button>
  );
};

export function Layout({ children }: LayoutProps) {
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        showToast('Command palette coming soon!', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToast]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setIsMobileMenuOpen(false);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Listen for route changes
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden selection:bg-violet-500/30">
      {/* Sidebar */}
      <div className={cx(
        "fixed md:static inset-y-0 left-0 z-40 w-64 bg-[#12121a] border-r border-white/10 flex flex-col transition-transform duration-300 transform",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            <BrainCircuit size={20} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">GM7 Agency</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-2 px-2">Menu</div>
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            path="/" 
            isActive={isActive('/')}
            onClick={() => navigate('/')}
          />
          <SidebarItem 
            icon={FolderKanban} 
            label="Projects" 
            path="/projects" 
            isActive={isActive('/projects')}
            onClick={() => navigate('/projects')}
          />
          <SidebarItem 
            icon={Activity} 
            label="Pipeline" 
            path="/pipeline" 
            isActive={isActive('/pipeline')}
            onClick={() => navigate('/pipeline')}
          />
          <SidebarItem 
            icon={Bot} 
            label="AI Agents" 
            path="/agents" 
            isActive={isActive('/agents')}
            onClick={() => navigate('/agents')}
          />
          <SidebarItem 
            icon={MessageSquare} 
            label="Chat" 
            path="/chat" 
            isActive={isActive('/chat')}
            onClick={() => navigate('/chat')}
          />
        </nav>

        <div className="p-4 border-t border-white/10">
          <SidebarItem 
            icon={Settings} 
            label="Settings" 
            path="/settings" 
            isActive={isActive('/settings')}
            onClick={() => navigate('/settings')}
          />
          <div className="mt-4 px-3 py-3 bg-[#1a1a24] rounded-lg border border-white/5 flex items-center justify-between text-xs text-gray-400">
            <span>Press <kbd className="bg-black px-1.5 py-0.5 rounded border border-white/10 text-gray-300">⌘K</kbd> to search</span>
            <Command size={14} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/10 bg-[#12121a]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="md:hidden text-gray-400 hover:text-white"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
              <Search size={14} />
              <span>Search projects, jobs, agents...</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 p-[1px]">
              <div className="w-full h-full bg-[#12121a] rounded-full flex items-center justify-center text-xs font-bold">
                GM
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
