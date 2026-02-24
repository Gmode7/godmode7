import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, PlayCircle, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx, formatDate, getStatusColor } from '../lib/utils';
import type { Project, Job } from '../types';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Job creation form
  const [strategy, setStrategy] = useState<'FAST' | 'BALANCED' | 'ENTERPRISE'>('BALANCED');
  const [riskClassification, setRiskClassification] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectData, jobsData] = await Promise.all([
        api.getProjects().then(d => d.projects.find((p: Project) => p.id === id)),
        api.getJobs(id),
      ]);
      setProject(projectData || null);
      setJobs(jobsData.jobs || []);
    } catch (err) {
      showToast('Failed to load project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!id) return;
    try {
      const job = await api.createJob({ 
        projectId: id, 
        strategy, 
        riskClassification 
      });
      showToast('Job created successfully');
      setIsModalOpen(false);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      showToast('Failed to create job', 'error');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Project not found</h2>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <button onClick={() => navigate('/projects')} className="hover:text-white transition-colors">Projects</button>
        <ChevronRight size={14} />
        <span className="text-white">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
          <p className="text-gray-400 max-w-2xl">{project.description || 'No description'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/projects')}>Back</Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <PlayCircle size={16}/> Start Pipeline
          </Button>
        </div>
      </div>

      {/* Jobs Table */}
      <div>
        <h2 className="text-xl font-bold mb-4">Pipeline Runs (Jobs)</h2>
        <Card className="overflow-hidden">
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="mb-4">No jobs running for this project.</p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus size={16} className="mr-2" /> Start First Pipeline
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#12121a] text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium">Job ID</th>
                  <th className="px-6 py-4 font-medium">State</th>
                  <th className="px-6 py-4 font-medium">Strategy</th>
                  <th className="px-6 py-4 font-medium">Risk</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map(job => (
                  <tr 
                    key={job.id} 
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-gray-300">{job.id}</td>
                    <td className="px-6 py-4">
                      <Badge className={getStatusColor(job.currentState)}>{job.currentState}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline">{job.strategy}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cx(
                        job.riskClassification === 'HIGH' ? 'text-rose-400' : 
                        job.riskClassification === 'MEDIUM' ? 'text-amber-400' : 
                        'text-emerald-400'
                      )}>
                        {job.riskClassification}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{formatDate(job.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="secondary" size="sm">View Pipeline</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Create Job Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Start New Pipeline">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Execution Strategy</label>
            <div className="grid grid-cols-3 gap-3">
              {(['FAST', 'BALANCED', 'ENTERPRISE'] as const).map(s => (
                <div 
                  key={s} 
                  onClick={() => setStrategy(s)}
                  className={cx(
                    "border rounded-lg p-3 text-center cursor-pointer transition-colors",
                    strategy === s 
                      ? "border-violet-500 bg-violet-500/10 text-violet-400" 
                      : "border-white/10 hover:border-violet-500/50"
                  )}
                >
                  <div className="text-xs font-bold">{s}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Risk Classification</label>
            <div className="grid grid-cols-3 gap-3">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map(r => (
                <div 
                  key={r} 
                  onClick={() => setRiskClassification(r)}
                  className={cx(
                    "border rounded-lg p-3 text-center cursor-pointer transition-colors",
                    riskClassification === r 
                      ? "border-violet-500 bg-violet-500/10 text-violet-400" 
                      : "border-white/10 hover:border-violet-500/50"
                  )}
                >
                  <div className="text-xs font-bold">{r}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateJob}>Start Pipeline</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
