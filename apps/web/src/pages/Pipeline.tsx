import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { usePipelineEvents } from '../lib/sse';
import { PipelineStepper, type StageStatus } from '../components/PipelineStepper';
import { StagePanel } from '../components/StagePanel';
import { toast } from '../components/ui/Toast';

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Intake Agent',
  PM: 'Product Manager',
  ARCH: 'Architect',
  ENG: 'Engineer',
  QA: 'QA Engineer',
  SEC: 'Security Architect',
  DOCS: 'Tech Writer',
};

const STAGE_ORDER = ['INTAKE', 'PM', 'ARCH', 'ENG', 'QA', 'SEC', 'DOCS'];

export function Pipeline() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // Start form state
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [brief, setBrief] = useState('');
  const [starting, setStarting] = useState(false);

  // Pipeline state
  const [jobData, setJobData] = useState<any>(null);
  const { events, currentStage, isComplete, error: sseError } = usePipelineEvents(jobId || null);

  // Load projects for the start form
  useEffect(() => {
    if (!jobId) {
      api.getProjects().then(data => {
        setProjects(data.projects || []);
        if (data.projects?.length > 0) {
          setSelectedProject(data.projects[0].id);
        }
      }).catch(() => {});
    }
  }, [jobId]);

  // Load job data when we have a jobId
  useEffect(() => {
    if (jobId) {
      api.pipeline.getPipelineStatus(jobId).then(setJobData).catch(() => {});
    }
  }, [jobId]);

  // Refresh job data when events come in
  useEffect(() => {
    if (jobId && events.length > 0) {
      api.pipeline.getPipelineStatus(jobId).then(setJobData).catch(() => {});
    }
  }, [jobId, events.length]);

  // Compute stage statuses from job state
  const stageStatuses = useMemo(() => {
    const statuses: Record<string, StageStatus> = {};
    if (!jobData) {
      STAGE_ORDER.forEach(s => { statuses[s] = 'pending'; });
      return statuses;
    }

    const state = jobData.currentState as string;

    for (const stage of STAGE_ORDER) {
      if (state === 'COMPLETED') {
        statuses[stage] = 'done';
      } else if (state === `${stage}_RUNNING`) {
        statuses[stage] = 'running';
      } else if (state === `${stage}_DONE`) {
        statuses[stage] = 'done';
      } else if (state === `${stage}_FAILED`) {
        statuses[stage] = 'failed';
      } else if (state === `${stage}_PENDING`) {
        statuses[stage] = 'pending';
      } else {
        // Check if this stage is before or after the current stage
        const currentIdx = STAGE_ORDER.findIndex(s =>
          state.startsWith(s)
        );
        const thisIdx = STAGE_ORDER.indexOf(stage);
        if (currentIdx >= 0 && thisIdx < currentIdx) {
          statuses[stage] = 'done';
        } else {
          statuses[stage] = 'pending';
        }
      }
    }
    return statuses;
  }, [jobData]);

  // Group artifacts by stage
  const artifactsByStage = useMemo(() => {
    const map: Record<string, Array<{ type: string; content: string }>> = {};
    STAGE_ORDER.forEach(s => { map[s] = []; });

    if (!jobData?.artifacts) return map;

    const stageArtifactTypes: Record<string, string[]> = {
      INTAKE: ['intake_brief', 'intake_questions'],
      PM: ['prd', 'backlog'],
      ARCH: ['architecture', 'adr'],
      ENG: ['engineering_plan', 'patch'],
      QA: ['test_plan', 'qa_matrix', 'qa_report'],
      SEC: ['threat_model', 'security_findings'],
      DOCS: ['docs_api', 'docs_readme'],
    };

    for (const artifact of jobData.artifacts) {
      for (const [stage, types] of Object.entries(stageArtifactTypes)) {
        if (types.includes(artifact.type)) {
          map[stage].push(artifact);
          break;
        }
      }
    }

    return map;
  }, [jobData]);

  // Get error for current failed stage from events
  const failedErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const event of events) {
      if (event.type === 'stage_failed' && event.stage && event.data?.error) {
        errors[event.stage] = event.data.error;
      }
    }
    return errors;
  }, [events]);

  const handleStart = async () => {
    if (!selectedProject || !brief.trim()) return;
    setStarting(true);
    try {
      const result = await api.pipeline.startPipeline({
        projectId: selectedProject,
        brief: brief.trim(),
      });
      toast('Pipeline started', 'success');
      navigate(`/pipeline/${result.jobId}`);
    } catch (err: any) {
      toast(err.message || 'Failed to start pipeline', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleRetry = async () => {
    if (!jobId) return;
    try {
      await api.pipeline.retryPipeline(jobId);
      toast('Retrying stage...', 'success');
    } catch (err: any) {
      toast(err.message || 'Retry failed', 'error');
    }
  };

  // ── No active job: show start form ──────────────────
  if (!jobId) {
    return (
      <div className="h-full overflow-auto p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Pipeline</h1>

        <div className="max-w-2xl bg-gray-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Start New Pipeline</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {projects.length === 0 && <option value="">No projects found</option>}
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project Brief</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe your project idea in detail..."
              rows={6}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <button
            onClick={handleStart}
            disabled={starting || !selectedProject || brief.trim().length < 10}
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {starting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
            ) : (
              <><Play className="w-4 h-4" /> Start Pipeline</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Active job: show pipeline dashboard ─────────────
  return (
    <div className="h-full overflow-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">
            Job: <span className="font-mono text-gray-300">{jobId.slice(0, 8)}...</span>
            {isComplete && <span className="ml-2 text-green-400">Complete</span>}
          </p>
        </div>
      </div>

      {sseError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          SSE connection error: {sseError}
        </div>
      )}

      {/* Stepper */}
      <div className="bg-gray-900/50 border border-white/10 rounded-xl">
        <PipelineStepper
          stages={stageStatuses}
          currentStage={currentStage || STAGE_ORDER[0]}
        />
      </div>

      {/* Stage panels */}
      <div className="space-y-3">
        {STAGE_ORDER.map(stage => (
          <StagePanel
            key={stage}
            stage={stage}
            label={STAGE_LABELS[stage]}
            status={stageStatuses[stage]}
            artifacts={artifactsByStage[stage]}
            error={failedErrors[stage]}
            onRetry={stageStatuses[stage] === 'failed' ? handleRetry : undefined}
          />
        ))}
      </div>
    </div>
  );
}
