import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Bot,
  Settings,
  MessageSquare,
  Sparkles,
  Workflow,
  PlusCircle,
  Rocket,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/projects', icon: FolderOpen, label: 'Projects' },
  { path: '/pipeline', icon: Workflow, label: 'Pipeline' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900/50 border-r border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">GM7</h1>
            <p className="text-xs text-gray-400">AI Software Agency</p>
          </div>
        </div>
      </div>

      {/* New Project CTA */}
      <div className="px-4 pt-4">
        <NavLink
          to="/start"
          className={({ isActive }) => `
            flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all
            ${isActive 
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25' 
              : 'bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30'
            }
          `}
        >
          <Rocket className="w-5 h-5" />
          <span>New Project</span>
          <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded">AI</span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all
              ${isActive 
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-gray-500 text-center">
          GM7 AI-Native Backend
        </div>
      </div>
    </aside>
  );
}
