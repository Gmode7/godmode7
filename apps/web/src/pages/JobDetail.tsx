import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Rocket, Shield, XCircle, CheckCircle2, CircleDashed, FileText, Bot, Terminal } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx, formatDate, getStatusColor, PIPELINE_STAGES } from '../lib/utils';
import type { Job, Project, Agent, Artifact } from '../types';

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'artifacts' | 'agent' | 'logs'>('artifacts');
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
      // Poll for updates if job is active
      const interval = setInterval(() => {
        if (job && job.currentState !== 'DONE' && job.currentState !== 'FAILED') {
          loadData();
        }
        setPulse(p => !p);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [id, job?.currentState]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [jobData, projectsData, agentsData, artifactsData] = await Promise.all([
        api.getJob(id),
        api.getProjects(),
        api.getAgents(),
        api.getArtifacts(id),
      ]);
      
      setJob(jobData);
      setProject(projectsData.projects.find((p: Project) => p.id === jobData.projectId) || null);
      setAgents(agentsData.agents || []);
      setArtifacts(artifactsData.artifacts || []);
    } catch (err) {
      showToast('Failed to load job', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    try {
      await api.retryPipeline(id);
      showToast('Pipeline retry initiated');
      loadData();
    } catch (err) {
      showToast('Failed to retry pipeline', 'error');
    }
  };

  const currentStageIndex = job ? PIPELINE_STAGES.indexOf(job.currentState) : -1;
  const activeAgent = agents.find(a => a.stage === job?.currentState);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading pipeline...</div>;
  }

  if (!job) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Job not found</h2>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1a1a24] p-6 rounded-xl border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-1">
            <button onClick={() => navigate('/projects')} className="hover:text-white transition-colors">Projects</button>
            <ChevronRight size={14} />
            {project && (
              <>
                <button onClick={() => navigate(`/projects/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
                <ChevronRight size={14} />
              </>
            )}
            <span className="text-white">Pipeline: {job.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Pipeline Execution
            <Badge className={getStatusColor(job.currentState)}>{job.currentState}</Badge>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="gap-2">
            <Shield size={16}/> Risk: {job.riskClassification}
          </Button>
          {job.currentState === 'FAILED' && (
            <Button variant="danger" className="gap-2" onClick={handleRetry}>
              <Rocket size={16}/> Retry Pipeline
            </Button>
          )}
        </div>
      </div>

      {/* Stage Visualizer */}
      <Card className="p-8 overflow-x-auto">
        <div className="relative flex justify-between items-center min-w-[600px]">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 rounded-full z-0"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full z-0 transition-all duration-1000 ease-in-out"
            style={{ width: `${(Math.max(0, currentStageIndex) / (PIPELINE_STAGES.length - 1)) * 100}%` }}
          ></div>

          {PIPELINE_STAGES.map((stage, index) => {
            const isCompleted = index < currentStageIndex || job.currentState === 'DONE';
            const isActive = index === currentStageIndex && job.currentState !== 'DONE' && job.currentState !== 'FAILED';
            const isFailed = index === currentStageIndex && job.currentState === 'FAILED';

            return (
              <div key={stage} className="relative z-10 flex flex-col items-center gap-3">
                <div 
                  className={cx(
                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-[#12121a]",
                    isCompleted ? "border-violet-500 text-violet-400" :
                    isActive ? "border-indigo-400 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-110" :
                    isFailed ? "border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]" :
                    "border-white/10 text-gray-500",
                    (isActive && pulse) && "animate-pulse"
                  )}
                >
                  {isCompleted ? <CheckCircle2 size={20} /> : 
                   isFailed ? <XCircle size={20} /> :
                   isActive ? <Rocket size={20} /> :
                   <CircleDashed size={20} />}
                </div>
                <span className={cx(
                  "text-xs font-bold tracking-wider",
                  isActive ? "text-indigo-400" : isFailed ? "text-rose-400" : isCompleted ? "text-gray-300" : "text-gray-600"
                )}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Content Area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <Card className="lg:w-64 p-2 flex flex-row lg:flex-col gap-1 flex-shrink-0 overflow-x-auto lg:overflow-visible">
          <button 
            onClick={() => setActiveTab('artifacts')}
            className={cx(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap",
              activeTab === 'artifacts' ? "bg-violet-500/10 text-violet-400" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <FileText size={18} /> Generated Artifacts
          </button>
          <button 
            onClick={() => setActiveTab('agent')}
            className={cx(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap",
              activeTab === 'agent' ? "bg-violet-500/10 text-violet-400" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Bot size={18} /> Active Agent
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={cx(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap",
              activeTab === 'logs' ? "bg-violet-500/10 text-violet-400" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Terminal size={18} /> Activity Logs
          </button>
        </Card>

        {/* Tab Content */}
        <Card className="flex-1 p-6 min-h-[500px]">
          {activeTab === 'artifacts' && (
            <div className="h-full flex flex-col space-y-4">
              <h3 className="text-lg font-semibold flex items-center justify-between">
                <span>Pipeline Artifacts</span>
                <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-1 rounded">
                  {artifacts.length} artifacts
                </span>
              </h3>
              {artifacts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p>No artifacts generated for this job yet.</p>
                  <p className="text-sm">Artifacts will appear as agents complete their stages.</p>
                </div>
              ) : (
                <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  {artifacts.map(artifact => (
                    <div key={artifact.id} className="border border-white/10 rounded-xl overflow-hidden">
                      <div className="bg-[#12121a] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{artifact.type}</Badge>
                          <span className="font-semibold text-sm text-gray-200">Artifact #{artifact.id.slice(0, 8)}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(artifact.createdAt)}</span>
                      </div>
                      <div className="p-6 bg-[#0a0a0f]/50">
                        <MarkdownRenderer content={artifact.content} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Agent Diagnostics</h3>
              {job.currentState === 'DONE' ? (
                <div className="text-gray-400">Pipeline is complete. All agents are idle.</div>
              ) : job.currentState === 'FAILED' ? (
                <div className="text-rose-400">Pipeline failed. Check logs for details.</div>
              ) : activeAgent ? (
                <div className="flex gap-6 items-start">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 relative">
                    <Bot size={40} className="text-violet-400 animate-pulse" />
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#1a1a24]"></div>
                  </div>
                  <div className="space-y-4 flex-1">
                    <div>
                      <h4 className="text-2xl font-bold text-white mb-1">{activeAgent.name}</h4>
                      <p className="text-violet-400 text-sm">Specialization: {activeAgent.stage} Stage</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-xs text-gray-500 block mb-1">Provider</span>
                        <span className="text-sm text-gray-300">{activeAgent.provider}</span>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-xs text-gray-500 block mb-1">Status</span>
                        <span className="text-sm text-emerald-400">{activeAgent.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">No agent currently assigned to this stage.</div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full flex flex-col font-mono text-xs">
              <h3 className="text-lg font-semibold font-sans mb-4">Execution Stream</h3>
              <div className="bg-[#0a0a0f] p-4 rounded-xl border border-white/10 flex-1 overflow-y-auto text-gray-400 space-y-2">
                <div><span className="text-blue-400">[{formatDate(job.createdAt)}]</span> [SYSTEM] Pipeline initialized with strategy {job.strategy}</div>
                <div><span className="text-blue-400">[{formatDate(job.createdAt)}]</span> [SYSTEM] Risk classification: {job.riskClassification}</div>
                <div><span className="text-emerald-400">[{formatDate(job.updatedAt)}]</span> [SYSTEM] Job created successfully</div>
                {job.currentState !== 'INTAKE' && (
                  <div><span className="text-emerald-400">[{formatDate(job.updatedAt)}]</span> [PIPELINE] Progressing through stages...</div>
                )}
                {job.currentState === 'FAILED' && (
                  <div><span className="text-rose-400">[{formatDate(job.updatedAt)}]</span> [ERROR] Pipeline execution failed</div>
                )}
                {job.currentState === 'DONE' && (
                  <div><span className="text-emerald-400">[{formatDate(job.updatedAt)}]</span> [SYSTEM] Pipeline completed successfully</div>
                )}
                <div className="mt-8 text-center text-gray-600">
                  {job.currentState === 'DONE' || job.currentState === 'FAILED' ? 'End of logs' : 'Waiting for updates...'}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
