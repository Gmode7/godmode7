// ═══════════════════════════════════════════════════════
// Pipeline Stage Definitions
// ═══════════════════════════════════════════════════════

export type PipelineStage = 'INTAKE' | 'PM' | 'ARCH' | 'ENG' | 'QA' | 'SEC' | 'DOCS';

export const PIPELINE_STAGES: PipelineStage[] = ['INTAKE', 'PM', 'ARCH', 'ENG', 'QA', 'SEC', 'DOCS'];

// ═══════════════════════════════════════════════════════
// 24-state per-agent pipeline + COMPLETED
// ═══════════════════════════════════════════════════════

export type JobState =
  | 'INTAKE_PENDING' | 'INTAKE_RUNNING' | 'INTAKE_DONE' | 'INTAKE_FAILED'
  | 'PM_PENDING' | 'PM_RUNNING' | 'PM_DONE' | 'PM_FAILED'
  | 'ARCH_PENDING' | 'ARCH_RUNNING' | 'ARCH_DONE' | 'ARCH_FAILED'
  | 'ENG_PENDING' | 'ENG_RUNNING' | 'ENG_DONE' | 'ENG_FAILED'
  | 'QA_PENDING' | 'QA_RUNNING' | 'QA_DONE' | 'QA_FAILED'
  | 'SEC_PENDING' | 'SEC_RUNNING' | 'SEC_DONE' | 'SEC_FAILED'
  | 'DOCS_PENDING' | 'DOCS_RUNNING' | 'DOCS_DONE' | 'DOCS_FAILED'
  | 'COMPLETED'
  // Legacy states for backward compat
  | 'PENDING_REQUIREMENTS' | 'REQUIREMENTS_COMPLETE'
  | 'IMPLEMENTATION_IN_PROGRESS' | 'IMPLEMENTATION_COMPLETE'
  | 'TESTING_IN_PROGRESS' | 'TESTING_COMPLETE'
  | 'DEPLOYED' | 'FAILED';

export const ALL_STATES: string[] = [
  'INTAKE_PENDING', 'INTAKE_RUNNING', 'INTAKE_DONE', 'INTAKE_FAILED',
  'PM_PENDING', 'PM_RUNNING', 'PM_DONE', 'PM_FAILED',
  'ARCH_PENDING', 'ARCH_RUNNING', 'ARCH_DONE', 'ARCH_FAILED',
  'ENG_PENDING', 'ENG_RUNNING', 'ENG_DONE', 'ENG_FAILED',
  'QA_PENDING', 'QA_RUNNING', 'QA_DONE', 'QA_FAILED',
  'SEC_PENDING', 'SEC_RUNNING', 'SEC_DONE', 'SEC_FAILED',
  'DOCS_PENDING', 'DOCS_RUNNING', 'DOCS_DONE', 'DOCS_FAILED',
  'COMPLETED',
];

export type ArtifactType =
  | 'intake_questions' | 'intake_brief'
  | 'prd' | 'backlog'
  | 'architecture' | 'adr'
  | 'engineering_plan' | 'patch'
  | 'test_plan' | 'qa_matrix' | 'qa_report'
  | 'threat_model' | 'security_findings'
  | 'docs_api' | 'docs_readme';

/** Map *_DONE state → required artifact types for that stage */
export const STAGE_GATE_ARTIFACTS: Record<string, string[]> = {
  INTAKE_DONE: ['intake_brief'],
  PM_DONE: ['prd', 'backlog'],
  ARCH_DONE: ['architecture', 'adr'],
  ENG_DONE: ['engineering_plan', 'patch'],
  QA_DONE: ['test_plan', 'qa_matrix', 'qa_report'],
  SEC_DONE: ['threat_model', 'security_findings'],
  DOCS_DONE: ['docs_api', 'docs_readme'],
};

// ═══════════════════════════════════════════════════════
// New pipeline state transitions
// ═══════════════════════════════════════════════════════

export const PIPELINE_STATE_TRANSITIONS: Record<string, string[]> = {};

for (const stage of PIPELINE_STAGES) {
  PIPELINE_STATE_TRANSITIONS[`${stage}_PENDING`] = [`${stage}_RUNNING`];
  PIPELINE_STATE_TRANSITIONS[`${stage}_RUNNING`] = [`${stage}_DONE`, `${stage}_FAILED`];
  PIPELINE_STATE_TRANSITIONS[`${stage}_DONE`] = [];   // filled dynamically by getNextStage
  PIPELINE_STATE_TRANSITIONS[`${stage}_FAILED`] = [`${stage}_PENDING`]; // retry
}
// Wire *_DONE → next stage's *_PENDING
for (let i = 0; i < PIPELINE_STAGES.length - 1; i++) {
  PIPELINE_STATE_TRANSITIONS[`${PIPELINE_STAGES[i]}_DONE`].push(`${PIPELINE_STAGES[i + 1]}_PENDING`);
}
PIPELINE_STATE_TRANSITIONS['DOCS_DONE'].push('COMPLETED');
PIPELINE_STATE_TRANSITIONS['COMPLETED'] = [];

// ═══════════════════════════════════════════════════════
// Legacy exports (backward compat with /jobs/:id/transition)
// ═══════════════════════════════════════════════════════

export const GATE_REQUIREMENTS: Record<string, Record<string, string[]>> = {
  A: { standard: ['REQUIREMENTS_REVIEW', 'CODE_REVIEW'], elevated: ['REQUIREMENTS_REVIEW', 'CODE_REVIEW', 'SECURITY_REVIEW'], critical: ['REQUIREMENTS_REVIEW', 'CODE_REVIEW', 'SECURITY_REVIEW', 'SBOM_AUDIT'] },
  B: { standard: ['CODE_REVIEW'], elevated: ['CODE_REVIEW', 'SECURITY_REVIEW'], critical: ['CODE_REVIEW', 'SECURITY_REVIEW'] },
  C: { standard: [], elevated: ['CODE_REVIEW'], critical: ['CODE_REVIEW', 'SECURITY_REVIEW'] }
};

export const STATE_TRANSITIONS: Record<string, string[]> = {
  PENDING_REQUIREMENTS: ['REQUIREMENTS_COMPLETE'],
  REQUIREMENTS_COMPLETE: ['IMPLEMENTATION_IN_PROGRESS'],
  IMPLEMENTATION_IN_PROGRESS: ['IMPLEMENTATION_COMPLETE'],
  IMPLEMENTATION_COMPLETE: ['TESTING_IN_PROGRESS'],
  TESTING_IN_PROGRESS: ['TESTING_COMPLETE', 'FAILED'],
  TESTING_COMPLETE: ['DEPLOYED'],
  DEPLOYED: ['COMPLETED'],
  COMPLETED: [], FAILED: ['PENDING_REQUIREMENTS'],
  // Also allow pipeline states via the transition endpoint
  ...PIPELINE_STATE_TRANSITIONS,
};

export const TRANSITION_GATES: Record<string, string[]> = {
  REQUIREMENTS_COMPLETE: ['REQUIREMENTS_REVIEW'],
  IMPLEMENTATION_COMPLETE: ['CODE_REVIEW'],
  TESTING_COMPLETE: ['SECURITY_REVIEW'],
  DEPLOYED: ['SBOM_AUDIT']
};
