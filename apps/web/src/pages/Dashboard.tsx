import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Briefcase, Bot, Plus, PlayCircle, CheckCircle2, XCircle, CircleDashed, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx, formatDateShort, getStatusColor } from '../lib/utils';
import type { Project, Job, Agent } from '../types';

interface Stats {
  projects: number;
  jobs: number;
  agents: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats>({ projects: 0, jobs: 0, agents: 0 });
  const [recentJobs, setRecentJobs] = useState<(Job & { projectName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, jobsData, agentsData] = await Promise.all([
        api.getProjects(),
        api.getJobs(),
        api.getAgents(),
      ]);

      const projects = projectsData.projects || [];
      const jobs = jobsData.jobs || [];
      const agents = agentsData.agents || [];

      setStats({
        projects: projects.length,
        jobs: jobs.length,
        agents: agents.filter((a: Agent) => a.isActive).length,
      });

      // Get recent jobs with project names
      const recent = jobs.slice(0, 5).map((job: Job) => ({
        ...job,
        projectName: projects.find((p: Project) => p.id === job.projectId)?.name || 'Unknown',
      }));
      setRecentJobs(recent);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#1a1a24] to-[#12121a] border border-white/10 p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400">GM7 AI Agency</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Your automated software development pipeline. Watch 7 specialized AI agents collaborate to plan, build, test, and secure your next big project.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => navigate('/projects')} className="gap-2">
              <Plus size={18} /> New Project
            </Button>
            <Button variant="secondary" onClick={() => navigate('/pipeline')} className="gap-2">
              <PlayCircle size={18} /> View Active Pipeline
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium">Total Projects</h3>
            <div className="p-2 bg-violet-500/10 rounded-lg"><FolderOpen size={20} className="text-violet-400" /></div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.projects}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium">Total Jobs</h3>
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Briefcase size={20} className="text-emerald-400" /></div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.jobs}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium">AI Agents Ready</h3>
            <div className="p-2 bg-pink-500/10 rounded-lg"><Bot size={20} className="text-pink-400" /></div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.agents}<span className="text-sm text-gray-500 font-normal ml-2">/ 7</span></div>
        </Card>
      </div>

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Pipeline Activity</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>View All</Button>
        </div>
        <Card className="overflow-hidden">
          <div className="divide-y divide-white/5">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No jobs yet. Create a project to start.</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/projects')}>
                  Create Project
                </Button>
              </div>
            ) : recentJobs.map(job => (
              <div 
                key={job.id} 
                onClick={() => navigate(`/jobs/${job.id}`)} 
                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className={cx("w-10 h-10 rounded-full flex items-center justify-center border", getStatusColor(job.currentState))}>
                    {job.currentState === 'DONE' ? <CheckCircle2 size={18} /> : 
                     job.currentState === 'FAILED' ? <XCircle size={18} /> : <CircleDashed size={18} />}
                  </div>
                  <div>
                    <h4 className="font-semibold group-hover:text-violet-400 transition-colors">{job.projectName}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>Job {job.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{formatDateShort(job.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={job.strategy === 'FAST' ? 'success' : job.strategy === 'BALANCED' ? 'warning' : 'default'}>
                    {job.strategy}
                  </Badge>
                  <Badge className={getStatusColor(job.currentState)}>{job.currentState}</Badge>
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
