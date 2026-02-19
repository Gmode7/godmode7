import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Briefcase, Bot, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';

interface Stats {
  projects: number;
  jobs: number;
  agents: number;
}

interface RecentJob {
  id: string;
  projectId: string;
  projectName: string;
  currentState: string;
  createdAt: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ projects: 0, jobs: 0, agents: 0 });
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, jobsData, agentsData] = await Promise.all([
        api.getProjects(),
        api.getJobs(),
        api.getAgents(),
      ]);

      setStats({
        projects: projectsData.projects?.length || 0,
        jobs: jobsData.jobs?.length || 0,
        agents: agentsData.agents?.length || 0,
      });

      // Get recent jobs with project names
      const jobs = jobsData.jobs?.slice(0, 5) || [];
      const projects = projectsData.projects || [];
      const recent = jobs.map((job: any) => ({
        ...job,
        projectName: projects.find((p: any) => p.id === job.projectId)?.name || 'Unknown',
      }));
      setRecentJobs(recent);
    } catch (err) {
      toast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to GM7</h1>
        <p className="text-gray-400">Your AI-powered software development agency</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div 
          onClick={() => navigate('/projects')}
          className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 hover:border-violet-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-violet-400" />
            </div>
            <span className="text-3xl font-bold text-white">{stats.projects}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Projects</h3>
          <p className="text-sm text-gray-400 group-hover:text-violet-300 transition-colors">
            Manage your development projects
          </p>
        </div>

        <div 
          onClick={() => navigate('/projects')}
          className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 hover:border-violet-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-3xl font-bold text-white">{stats.jobs}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Jobs</h3>
          <p className="text-sm text-gray-400 group-hover:text-violet-300 transition-colors">
            Active development jobs
          </p>
        </div>

        <div 
          onClick={() => navigate('/agents')}
          className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 hover:border-violet-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-pink-400" />
            </div>
            <span className="text-3xl font-bold text-white">{stats.agents}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">AI Agents</h3>
          <p className="text-sm text-gray-400 group-hover:text-violet-300 transition-colors">
            Available AI specialists
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Jobs */}
        <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Jobs</h3>
            <button
              onClick={() => navigate('/projects')}
              className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No jobs yet</p>
              <Button
                size="sm"
                onClick={() => navigate('/projects')}
              >
                Create a Job
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-white">{job.projectName}</p>
                    <p className="text-sm text-gray-400">
                      Job {job.id.slice(0, 8)} • {job.currentState}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(job.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Quick Actions</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate('/projects')}
              className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all text-left"
            >
              <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="font-medium text-white">Create Project</p>
                <p className="text-sm text-gray-400">Start a new development project</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all text-left"
            >
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white">Open Chat</p>
                <p className="text-sm text-gray-400">Chat with the GM7 assistant</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/agents')}
              className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all text-left"
            >
              <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <p className="font-medium text-white">Check Agent Status</p>
                <p className="text-sm text-gray-400">View AI agent readiness</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
