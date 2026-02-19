import { getSettings } from './store';

export type ApiError = {
  status: number;
  message: string;
  data?: any;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Event emitter for auth errors
type ErrorHandler = (error: ApiClientError) => void;
const errorHandlers: ErrorHandler[] = [];

export function onApiError(handler: ErrorHandler) {
  errorHandlers.push(handler);
  return () => {
    const idx = errorHandlers.indexOf(handler);
    if (idx > -1) errorHandlers.splice(idx, 1);
  };
}

function emitError(error: ApiClientError) {
  errorHandlers.forEach(h => h(error));
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const settings = getSettings();
  const url = `${settings.baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (settings.apiKey) {
    headers['x-api-key'] = settings.apiKey;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle specific error codes
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new ApiClientError(
        data.error || data.message || `HTTP ${response.status}`,
        response.status,
        data
      );

      // Emit error for global handling
      if (response.status === 401 || response.status === 503) {
        emitError(error);
      }

      throw error;
    }

    // Handle empty responses
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    // Network or other errors
    throw new ApiClientError(
      err instanceof Error ? err.message : 'Network error',
      0
    );
  }
}

// API endpoints
export const api = {
  // Health
  health: () => fetchWithAuth('/health'),
  
  // Projects
  getProjects: () => fetchWithAuth('/api/v1/projects'),
  createProject: (data: { name: string; description?: string; clientId?: string }) =>
    fetchWithAuth('/api/v1/projects', { method: 'POST', body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    fetchWithAuth(`/api/v1/projects/${id}`, { method: 'DELETE' }),
  
  // Jobs
  getJobs: (projectId?: string) =>
    fetchWithAuth(`/api/v1/jobs${projectId ? `?projectId=${projectId}` : ''}`),
  getJob: (id: string) => fetchWithAuth(`/api/v1/jobs/${id}`),
  createJob: (data: { projectId: string; strategy?: string; riskClassification?: string }) =>
    fetchWithAuth('/api/v1/jobs', { method: 'POST', body: JSON.stringify(data) }),
  transitionJob: (id: string, targetState: string) =>
    fetchWithAuth(`/api/v1/jobs/${id}/transition`, { 
      method: 'POST', 
      body: JSON.stringify({ targetState }) 
    }),
  
  // Artifacts
  getArtifacts: (jobId: string) =>
    fetchWithAuth(`/api/v1/artifacts/job/${jobId}`),
  
  // Gates
  getGates: (jobId: string) =>
    fetchWithAuth(`/api/v1/gates/job/${jobId}`),
  checkGate: (jobId: string, gateType: string) =>
    fetchWithAuth('/api/v1/gates/check', {
      method: 'POST',
      body: JSON.stringify({ jobId, gateType }),
    }),
  getGateDefinitions: () =>
    fetchWithAuth('/api/v1/gates/definitions'),
  
  // Chat
  getChatMessages: () => fetchWithAuth('/api/v1/chat/messages'),
  sendChatMessage: (content: string, jobId?: string, projectId?: string) =>
    fetchWithAuth('/api/v1/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ content, jobId, projectId }),
    }),
  clearChat: () =>
    fetchWithAuth('/api/v1/chat/messages', { method: 'DELETE' }),
  
  // Admin - Agents
  getAgents: () => fetchWithAuth('/api/v1/admin/agents'),
  getAgentReadiness: () => fetchWithAuth('/api/v1/admin/agents/readiness'),
  setAgentReady: (id: string, isReady: boolean, note?: string) =>
    fetchWithAuth(`/api/v1/admin/agents/${id}/ready`, {
      method: 'POST',
      body: JSON.stringify({ isReady, note }),
    }),
  
  // Pipeline
  pipeline: {
    startPipeline: (data: { projectId: string; brief: string }) =>
      fetchWithAuth('/api/v1/pipeline/start', { method: 'POST', body: JSON.stringify(data) }),
    getPipelineStatus: (jobId: string) =>
      fetchWithAuth(`/api/v1/pipeline/${jobId}/status`),
    retryPipeline: (jobId: string) =>
      fetchWithAuth(`/api/v1/pipeline/${jobId}/retry`, { method: 'POST' }),
  },

  // Agent endpoints
  agents: {
    // PM
    generatePRD: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/pm/prd`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateBacklog: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/pm/backlog`, { method: 'POST', body: JSON.stringify(data || {}) }),
    
    // Tech
    generateArch: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/tech/arch`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateADRs: (jobId: string, data: { decisions: string[]; context?: string }) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/tech/adrs`, { method: 'POST', body: JSON.stringify(data) }),
    
    // Eng
    generatePlan: (jobId: string, data: { request: string; repoContext?: string; constraints?: string }) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/eng/plan`, { method: 'POST', body: JSON.stringify(data) }),
    generatePatch: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/eng/patch`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateTests: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/eng/tests`, { method: 'POST', body: JSON.stringify(data || {}) }),
    
    // QA
    generateMatrix: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/qa/matrix`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateReport: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/qa/report`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateChecklist: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/qa/checklist`, { method: 'POST', body: JSON.stringify(data || {}) }),
    
    // Security
    generateThreatModel: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/security/threat-model`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateFindings: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/security/findings`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateFixPlan: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/security/fix-plan`, { method: 'POST', body: JSON.stringify(data || {}) }),
    
    // Docs
    generateReadme: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/docs/readme`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateApiDocs: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/docs/api`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateGuide: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/docs/guide`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateChangelog: (jobId: string, data?: any) =>
      fetchWithAuth(`/api/v1/jobs/${jobId}/docs/changelog`, { method: 'POST', body: JSON.stringify(data || {}) }),
  },
};
