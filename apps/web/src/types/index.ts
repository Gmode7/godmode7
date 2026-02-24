// Types matching the backend API

export type JobState = 'INTAKE' | 'PM' | 'ARCH' | 'ENG' | 'QA' | 'SEC' | 'DOCS' | 'DONE' | 'FAILED';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  projectId: string;
  currentState: JobState;
  strategy: 'FAST' | 'BALANCED' | 'ENTERPRISE';
  riskClassification: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
  gates?: Gate[];
  artifacts?: Artifact[];
}

export interface Gate {
  id: string;
  jobId: string;
  gateType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  jobId: string;
  type: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  stage: string;
  provider: string;
  model?: string;
  isActive: boolean;
  isReady?: boolean;
  version?: string;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
