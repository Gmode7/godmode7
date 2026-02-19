import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Briefcase, Calendar, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

interface Job {
  id: string;
  projectId: string;
  strategy: string;
  riskClassification: string;
  currentState: string;
  createdAt: string;
  updatedAt: string;
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJob, setNewJob] = useState({
    strategy: 'A',
    riskClassification: 'standard',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Get project from projects list (no single project endpoint)
      const projectsData = await api.getProjects();
      const proj = projectsData.projects?.find((p: Project) => p.id === id);
      if (proj) {
        setProject(proj);
      }

      // Get jobs for this project
      const jobsData = await api.getJobs(id);
      setJobs(jobsData.jobs || []);
    } catch (err) {
      toast('Failed to load project data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setCreating(true);
      await api.createJob({
        projectId: id,
        strategy: newJob.strategy,
        riskClassification: newJob.riskClassification,
      });
      toast('Job created successfully', 'success');
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast('Failed to create job', 'error');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'PENDING_REQUIREMENTS':
        return 'warning';
      case 'REQUIREMENTS_COMPLETE':
        return 'info';
      case 'IN_PROGRESS':
        return 'info';
      case 'COMPLETED':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <h2 className="text-xl text-white mb-2">Project not found</h2>
          <Button variant="secondary" onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{project.name}</h1>
            {project.description && (
              <p className="text-gray-400">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            Created {formatDate(project.createdAt)}
          </div>
        </div>
      </div>

      {/* Jobs Section */}
      <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold text-white">Jobs</h2>
            <Badge variant="default">{jobs.length}</Badge>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Job
          </Button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
            <p className="text-gray-400 mb-4">No jobs yet</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Create First Job
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:border-violet-500/30 hover:bg-white/[0.07] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Job {job.id.slice(0, 8)}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>Strategy: {job.strategy}</span>
                      <span>•</span>
                      <span>Risk: {job.riskClassification}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getStateColor(job.currentState) as any}>
                    {job.currentState}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {formatDate(job.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Job"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Strategy
            </label>
            <select
              value={newJob.strategy}
              onChange={(e) => setNewJob({ ...newJob, strategy: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="A">A - Standard</option>
              <option value="B">B - Enhanced</option>
              <option value="C">C - Minimal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Risk Classification
            </label>
            <select
              value={newJob.riskClassification}
              onChange={(e) => setNewJob({ ...newJob, riskClassification: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="standard">Standard</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical</option>
              <option value="low">Low Risk</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={creating}
              className="flex-1"
            >
              Create Job
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
