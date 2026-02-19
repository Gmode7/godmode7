import { useEffect, useState } from 'react';
import { Bot, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';

interface Agent {
  id: string;
  name: string;
  role: string;
  provider: string;
  isActive: boolean;
  isReady: boolean;
  readinessNote?: string;
}

interface AgentStatus extends Agent {
  missingEnv: string[];
  overallReady: boolean;
}

const providerIcons: Record<string, string> = {
  openai: '🤖',
  kimi: '🌙',
  claude: '⚡',
  none: '🔧',
};

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  kimi: 'Kimi (Moonshot)',
  claude: 'Claude (Anthropic)',
  none: 'No LLM',
};

export function Agents() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [overallOk, setOverallOk] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await api.getAgentReadiness();
      setAgents(data.agents || []);
      setOverallOk(data.ok);
    } catch (err) {
      toast('Failed to load agent status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleReady = async (agent: AgentStatus) => {
    try {
      setToggling(agent.id);
      await api.setAgentReady(agent.id, !agent.isReady);
      toast(`Agent ${agent.isReady ? 'marked not ready' : 'marked ready'}`, 'success');
      loadAgents();
    } catch (err) {
      toast('Failed to update agent status', 'error');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Agent Registry</h1>
          <p className="text-gray-400">
            Manage AI agent readiness and configuration
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={loadAgents}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <div className={`p-6 rounded-2xl border mb-8 ${overallOk ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
        <div className="flex items-center gap-4">
          {overallOk ? (
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          )}
          <div>
            <h2 className={`text-xl font-semibold ${overallOk ? 'text-emerald-300' : 'text-amber-300'}`}>
              {overallOk ? 'All Systems Ready' : 'Configuration Pending'}
            </h2>
            <p className={`mt-1 ${overallOk ? 'text-emerald-200/70' : 'text-amber-200/70'}`}>
              {overallOk 
                ? 'All agents are configured and ready to accept tasks.'
                : 'Some agents are missing required API keys. Add keys to Replit Secrets to enable them.'}
            </p>
          </div>
        </div>
      </div>

      {/* Required Environment Variables */}
      <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Required Environment Variables</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🤖</span>
              <span className="font-medium text-white">OpenAI</span>
            </div>
            <code className="text-sm text-violet-300">OPENAI_API_KEY</code>
            <p className="text-xs text-gray-500 mt-1">For Intake, PM, QA, Security</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🌙</span>
              <span className="font-medium text-white">Kimi</span>
            </div>
            <code className="text-sm text-violet-300">KIMI_API_KEY</code>
            <p className="text-xs text-gray-500 mt-1">For Architect, DevOps, Tech Writer</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚡</span>
              <span className="font-medium text-white">Claude</span>
            </div>
            <code className="text-sm text-violet-300">ANTHROPIC_API_KEY</code>
            <p className="text-xs text-gray-500 mt-1">For Software Engineer</p>
          </div>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-6 rounded-2xl border transition-all ${
              agent.overallReady
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-gray-900/50 border-white/10'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center text-2xl">
                  {providerIcons[agent.provider] || '🔧'}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{agent.name}</h3>
                  <p className="text-sm text-gray-400">{providerNames[agent.provider]}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={agent.overallReady ? 'success' : 'warning'}>
                  {agent.overallReady ? 'Ready' : 'Not Ready'}
                </Badge>
                <button
                  onClick={() => toggleReady(agent)}
                  disabled={toggling === agent.id}
                  className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50"
                >
                  {toggling === agent.id ? 'Updating...' : agent.isReady ? 'Mark Not Ready' : 'Mark Ready'}
                </button>
              </div>
            </div>

            {/* Status Details */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {agent.isActive ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className={agent.isActive ? 'text-gray-300' : 'text-red-400'}>
                  Active
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {agent.isReady ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-500" />
                )}
                <span className={agent.isReady ? 'text-gray-300' : 'text-gray-500'}>
                  Marked Ready
                </span>
              </div>

              {agent.missingEnv.length > 0 && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Missing Environment Variables:</p>
                    <ul className="mt-1 space-y-1">
                      {agent.missingEnv.map((env) => (
                        <li key={env} className="text-red-300/80 font-mono text-xs">
                          {env}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {agent.readinessNote && (
                <p className="text-gray-500 mt-2 italic">
                  Note: {agent.readinessNote}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-8 p-6 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
        <h3 className="font-semibold text-violet-300 mb-2">About Agent Readiness</h3>
        <ul className="space-y-2 text-sm text-violet-200/70">
          <li>• An agent is "ready" when it's active, marked ready, and has all required API keys.</li>
          <li>• You can manually toggle the "ready" flag to take an agent offline for maintenance.</li>
          <li>• API keys are configured on the server side (Replit Secrets) - not in this UI.</li>
          <li>• Missing keys will be added at the end of the setup process.</li>
        </ul>
      </div>
    </div>
  );
}
