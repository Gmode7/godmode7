import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx } from '../lib/utils';
import type { Agent } from '../types';

export function Agents() {
  const { showToast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await api.getAgents();
      setAgents(data.agents || []);
    } catch (err) {
      showToast('Failed to load agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReady = async (agent: Agent) => {
    try {
      await api.setAgentReady(agent.id, !agent.isReady, 'Toggled by user');
      showToast(`${agent.name} ${agent.isReady ? 'marked not ready' : 'is now ready'}`);
      loadAgents();
    } catch (err) {
      showToast('Failed to update agent', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AI Agents Matrix</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Card key={i} className="p-6 h-64 animate-pulse bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agents Matrix</h1>
          <p className="text-gray-400 text-sm mt-1">Manage and monitor the 7 specialized AI agents in the GM7 pipeline.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {agents.map(agent => (
          <Card key={agent.id} className="p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4">
              <div className={cx(
                "w-2.5 h-2.5 rounded-full shadow-[0_0_8px]",
                agent.isReady ? "bg-emerald-500 shadow-emerald-500/50" : "bg-amber-500 shadow-amber-500/50"
              )} />
            </div>
            
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <Bot size={28} className={agent.isReady ? "text-violet-400" : "text-gray-500"} />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{agent.stage} Stage</Badge>
            </div>
            
            <div className="space-y-2 text-sm text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-gray-200">{agent.provider}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={agent.isActive ? "text-emerald-400" : "text-gray-500"}>
                  {agent.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="mt-6">
               <Button 
                variant={agent.isReady ? 'secondary' : 'primary'} 
                className="w-full"
                onClick={() => handleToggleReady(agent)}
               >
                 {agent.isReady ? 'Reconfigure' : 'Initialize Agent'}
               </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
