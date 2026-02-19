import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FileText, Shield, Play, X, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';

interface Job {
  id: string;
  projectId: string;
  strategy: string;
  riskClassification: string;
  currentState: string;
  createdAt: string;
  updatedAt: string;
}

interface Artifact {
  id: string;
  type: string;
  content: any;
  hash: string;
  createdAt: string;
}

interface Gate {
  id: string;
  gateType: string;
  status: 'PENDING' | 'PASS' | 'FAIL';
  reason?: string;
  checkedAt?: string;
}

const agentButtons = [
  {
    category: 'Intake',
    agents: [
      { id: 'intake-questions', name: 'Questions', icon: '❓', endpoint: 'intake/questions' },
      { id: 'intake-brief', name: 'Brief', icon: '📋', endpoint: 'intake/brief' },
    ]
  },
  {
    category: 'Product',
    agents: [
      { id: 'pm-prd', name: 'PRD', icon: '📄', endpoint: 'pm/prd' },
      { id: 'pm-backlog', name: 'Backlog', icon: '📚', endpoint: 'pm/backlog' },
    ]
  },
  {
    category: 'Architecture',
    agents: [
      { id: 'tech-arch', name: 'ARCH', icon: '🏗️', endpoint: 'tech/arch' },
      { id: 'tech-adrs', name: 'ADRs', icon: '📝', endpoint: 'tech/adrs' },
    ]
  },
  {
    category: 'Engineering',
    agents: [
      { id: 'eng-plan', name: 'Plan', icon: '🔧', endpoint: 'eng/plan' },
      { id: 'eng-patch', name: 'Patch', icon: '🔨', endpoint: 'eng/patch' },
      { id: 'eng-tests', name: 'Tests', icon: '🧪', endpoint: 'eng/tests' },
    ]
  },
  {
    category: 'QA',
    agents: [
      { id: 'qa-matrix', name: 'Matrix', icon: '✅', endpoint: 'qa/matrix' },
      { id: 'qa-report', name: 'Report', icon: '📊', endpoint: 'qa/report' },
      { id: 'qa-checklist', name: 'Checklist', icon: '☑️', endpoint: 'qa/checklist' },
    ]
  },
  {
    category: 'Security',
    agents: [
      { id: 'security-threat', name: 'Threat Model', icon: '🛡️', endpoint: 'security/threat-model' },
      { id: 'security-findings', name: 'Findings', icon: '🔍', endpoint: 'security/findings' },
      { id: 'security-fix', name: 'Fix Plan', icon: '🔒', endpoint: 'security/fix-plan' },
    ]
  },
  {
    category: 'Documentation',
    agents: [
      { id: 'docs-readme', name: 'README', icon: '📖', endpoint: 'docs/readme' },
      { id: 'docs-api', name: 'API Docs', icon: '📑', endpoint: 'docs/api' },
      { id: 'docs-guide', name: 'Guide', icon: '📕', endpoint: 'docs/guide' },
      { id: 'docs-changelog', name: 'Changelog', icon: '📰', endpoint: 'docs/changelog' },
    ]
  },
];

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [jobData, artifactsData, gatesData] = await Promise.all([
        api.getJob(id),
        api.getArtifacts(id),
        api.getGates(id),
      ]);
      setJob(jobData);
      setArtifacts(artifactsData.artifacts || []);
      setGates(gatesData.gates || []);
    } catch (err) {
      toast('Failed to load job data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const runAgent = async (endpoint: string) => {
    if (!id) return;
    setRunningAgent(endpoint);
    
    try {
      // Map endpoint to api function
      const endpointMap: Record<string, () => Promise<any>> = {
        'intake/questions': () => api.agents.generatePRD(id, { idea: 'placeholder' }), // Adjust as needed
        'pm/prd': () => api.agents.generatePRD(id),
        'pm/backlog': () => api.agents.generateBacklog(id),
        'tech/arch': () => api.agents.generateArch(id),
        'tech/adrs': () => api.agents.generateADRs(id, { decisions: ['Architecture decision'] }),
        'eng/plan': () => api.agents.generatePlan(id, { request: 'Generate engineering plan' }),
        'eng/patch': () => api.agents.generatePatch(id),
        'eng/tests': () => api.agents.generateTests(id),
        'qa/matrix': () => api.agents.generateMatrix(id),
        'qa/report': () => api.agents.generateReport(id),
        'qa/checklist': () => api.agents.generateChecklist(id),
        'security/threat-model': () => api.agents.generateThreatModel(id),
        'security/findings': () => api.agents.generateFindings(id),
        'security/fix-plan': () => api.agents.generateFixPlan(id),
        'docs/readme': () => api.agents.generateReadme(id),
        'docs/api': () => api.agents.generateApiDocs(id),
        'docs/guide': () => api.agents.generateGuide(id),
        'docs/changelog': () => api.agents.generateChangelog(id),
      };

      const fn = endpointMap[endpoint];
      if (fn) {
        await fn();
        toast('Agent completed successfully', 'success');
        loadData();
      }
    } catch (err: any) {
      if (err.status === 503) {
        toast('Provider not configured yet', 'warning');
      } else {
        toast(err.message || 'Agent failed', 'error');
      }
    } finally {
      setRunningAgent(null);
    }
  };

  const getArtifactDisplayName = (type: string) => {
    const names: Record<string, string> = {
      intake_questions: 'Intake Questions',
      intake_brief: 'Intake Brief',
      prd: 'PRD',
      backlog: 'Backlog',
      architecture: 'ARCH',
      adr: 'ADR',
      engineering_plan: 'Engineering Plan',
      patch: 'PATCH',
      test_plan: 'Test Plan',
      qa_matrix: 'QA Matrix',
      qa_report: 'QA Report',
      qa_checklist: 'QA Checklist',
      threat_model: 'Threat Model',
      security_findings: 'Security Findings',
      security_fix_plan: 'Fix Plan',
      docs_readme: 'README',
      docs_api: 'API Docs',
      docs_guide: 'User Guide',
      docs_changelog: 'Changelog',
    };
    return names[type] || type;
  };

  const getArtifactFilename = (artifact: Artifact) => {
    if (artifact.content?.filename) return artifact.content.filename;
    if (artifact.content?.markdown) {
      const type = artifact.type;
      const ext = type.includes('patch') ? 'diff' : 'md';
      return `${type}.${ext}`;
    }
    return artifact.type;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <h2 className="text-xl text-white mb-2">Job not found</h2>
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
          onClick={() => navigate(`/projects/${job.projectId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Job {job.id.slice(0, 8)}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Strategy: {job.strategy}</span>
              <span>•</span>
              <span>Risk: {job.riskClassification}</span>
              <span>•</span>
              <Badge variant={job.currentState === 'COMPLETED' ? 'success' : 'info'}>
                {job.currentState}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Agents & Gates */}
        <div className="lg:col-span-1 space-y-6">
          {/* Run Agents */}
          <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-violet-400" />
              Run Agents
            </h3>
            
            <div className="space-y-4">
              {agentButtons.map((group) => (
                <div key={group.category}>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                    {group.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {group.agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => runAgent(agent.endpoint)}
                        disabled={runningAgent === agent.endpoint}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-all"
                      >
                        {runningAgent === agent.endpoint ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>{agent.icon}</span>
                        )}
                        {agent.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gates */}
          <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-400" />
              Gates
            </h3>
            
            {gates.length === 0 ? (
              <p className="text-gray-500 text-sm">No gates yet</p>
            ) : (
              <div className="space-y-2">
                {gates.map((gate) => (
                  <div
                    key={gate.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <span className="text-sm text-gray-300">{gate.gateType}</span>
                    <Badge
                      variant={
                        gate.status === 'PASS'
                          ? 'success'
                          : gate.status === 'FAIL'
                          ? 'error'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {gate.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Artifacts */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-400" />
              Artifacts
              <Badge variant="default">{artifacts.length}</Badge>
            </h3>

            {artifacts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                <p className="text-gray-400 mb-2">No artifacts yet</p>
                <p className="text-sm text-gray-500">
                  Run an agent from the left panel to generate artifacts
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    onClick={() => setSelectedArtifact(artifact)}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:border-violet-500/30 hover:bg-white/[0.07] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">
                          {getArtifactDisplayName(artifact.type)}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {getArtifactFilename(artifact)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(artifact.createdAt)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Artifact Viewer Modal */}
      <Modal
        isOpen={!!selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
        title={selectedArtifact ? getArtifactDisplayName(selectedArtifact.type) : ''}
        size="lg"
      >
        {selectedArtifact && (
          <div className="h-[70vh]">
            <MarkdownViewer
              content={selectedArtifact.content?.markdown || JSON.stringify(selectedArtifact.content, null, 2)}
              filename={getArtifactFilename(selectedArtifact)}
              onClose={() => setSelectedArtifact(null)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
