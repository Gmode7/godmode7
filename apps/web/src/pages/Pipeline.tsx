import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cx, getStatusColor } from '../lib/utils';
import type { Job, Project } from '../types';

export function Pipeline() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsData, projectsData] = await Promise.all([
        api.getJobs(),
        api.getProjects(),
      ]);
      setJobs(jobsData.jobs || []);
      setProjects(projectsData.projects || []);
    } catch (err) {
      showToast('Failed to load pipeline data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Unknown';
  };

  // Group jobs by state
  const jobsByState: Record<string, Job[]> = {};
  jobs.forEach(job => {
    if (!jobsByState[job.currentState]) {
      jobsByState[job.currentState] = [];
    }
    jobsByState[job.currentState].push(job);
  });

  const stages = ['INTAKE', 'PM', 'ARCH', 'ENG', 'QA', 'SEC', 'DOCS', 'DONE', 'FAILED'];

  if (jobId) {
    // If jobId is provided, redirect to JobDetail
    navigate(`/jobs/${jobId}`);
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Overview</h1>
          <p className="text-gray-400 text-sm mt-1">Visualize all active pipelines across stages</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6 h-96 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-white mb-2">No active pipelines</h3>
          <p className="text-gray-400 mb-6">Create a project and start a pipeline to see it here.</p>
          <Button onClick={() => navigate('/projects')}>Go to Projects</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stages.map(stage => (
            <div key={stage} className="bg-[#12121a] rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">{stage}</h3>
                <Badge variant="outline">{jobsByState[stage]?.length || 0}</Badge>
              </div>
              <div className="space-y-3 min-h-[100px]">
                {jobsByState[stage]?.map(job => (
                  <Card 
                    key={job.id} 
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="p-3 cursor-pointer hover:border-violet-500/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-400">{job.id.slice(0, 8)}</span>
                      <ChevronRight size={14} className="text-gray-600" />
                    </div>
                    <p className="text-sm font-medium text-white truncate">{getProjectName(job.projectId)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{job.strategy}</Badge>
                    </div>
                  </Card>
                ))}
                {!jobsByState[stage]?.length && (
                  <div className="text-center text-gray-600 text-sm py-8">No jobs</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
