import {
  GATE_REQUIREMENTS,
  STATE_TRANSITIONS,
  TRANSITION_GATES,
  STAGE_GATE_ARTIFACTS,
  PIPELINE_STAGES,
  type PipelineStage,
} from '../schemas/index.js';

export interface GateResult {
  gateType: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  reason?: string;
}

export class GatesEngine {
  // ── Legacy methods (backward compat) ─────────────────

  getRequiredGates(strategy: string, risk: string): string[] {
    return GATE_REQUIREMENTS[strategy]?.[risk] || [];
  }

  checkGate(gateType: string, artifacts: { type: string }[], existing: GateResult[]): GateResult {
    const prev = existing.find(g => g.gateType === gateType);
    if (prev?.status === 'PASS') return prev;

    // Merge legacy + pipeline artifact requirements
    const reqs: Record<string, string[]> = {
      REQUIREMENTS_REVIEW: ['REQUIREMENTS_DOC'],
      CODE_REVIEW: ['CODE_SNAPSHOT'],
      SECURITY_REVIEW: ['SECURITY_SCAN'],
      SBOM_AUDIT: ['SBOM'],
      ...STAGE_GATE_ARTIFACTS,
    };

    const needed = reqs[gateType] || [];
    const types = artifacts.map(a => a.type);
    const missing = needed.filter(r => !types.includes(r));
    return missing.length
      ? { gateType, status: 'FAIL', reason: `Missing: ${missing.join(', ')}` }
      : { gateType, status: 'PASS' };
  }

  getValidTransitions(state: string, strategy: string, risk: string, passed: string[]) {
    const next = STATE_TRANSITIONS[state] || [];
    const req = this.getRequiredGates(strategy, risk);
    return next.map(s => {
      const gates = (TRANSITION_GATES[s] || []).filter(g => req.includes(g));
      const miss = gates.filter(g => !passed.includes(g));
      return { state: s, allowed: !miss.length, missingGates: miss };
    });
  }

  getGateDefinitions() {
    return [
      { type: 'INTAKE_DONE', description: 'Intake brief completed', requiresArtifacts: ['intake_brief'] },
      { type: 'PM_DONE', description: 'PRD and backlog completed', requiresArtifacts: ['prd', 'backlog'] },
      { type: 'ARCH_DONE', description: 'Architecture and ADRs completed', requiresArtifacts: ['architecture', 'adr'] },
      { type: 'ENG_DONE', description: 'Engineering plan and patch completed', requiresArtifacts: ['engineering_plan', 'patch'] },
      { type: 'QA_DONE', description: 'QA test plan, matrix, and report completed', requiresArtifacts: ['test_plan', 'qa_matrix', 'qa_report'] },
      { type: 'SEC_DONE', description: 'Threat model and security findings completed', requiresArtifacts: ['threat_model', 'security_findings'] },
      { type: 'DOCS_DONE', description: 'API docs and README completed', requiresArtifacts: ['docs_api', 'docs_readme'] },
      // Legacy
      { type: 'REQUIREMENTS_REVIEW', description: 'Review requirements', requiresArtifacts: ['REQUIREMENTS_DOC'] },
      { type: 'CODE_REVIEW', description: 'Review code', requiresArtifacts: ['CODE_SNAPSHOT'] },
      { type: 'SECURITY_REVIEW', description: 'Security scan', requiresArtifacts: ['SECURITY_SCAN'] },
      { type: 'SBOM_AUDIT', description: 'SBOM audit', requiresArtifacts: ['SBOM'] },
    ];
  }

  // ── New pipeline methods ─────────────────────────────

  /**
   * Check if all required artifacts for a stage's gate exist.
   */
  checkStageGate(stage: string, artifactTypes: string[]): { passed: boolean; missing: string[] } {
    const doneState = `${stage}_DONE`;
    const required = STAGE_GATE_ARTIFACTS[doneState] || [];
    const missing = required.filter(r => !artifactTypes.includes(r));
    return { passed: missing.length === 0, missing };
  }

  /**
   * Given a current state, return the next stage's _PENDING state.
   * Returns null after DOCS_DONE (pipeline complete) or COMPLETED.
   */
  getNextStage(currentState: string): string | null {
    // Must be in a *_DONE state to advance
    if (!currentState.endsWith('_DONE')) return null;
    if (currentState === 'COMPLETED') return null;

    const stagePrefix = currentState.replace('_DONE', '') as PipelineStage;
    const idx = PIPELINE_STAGES.indexOf(stagePrefix);
    if (idx === -1) return null;

    if (idx === PIPELINE_STAGES.length - 1) {
      // Last stage done → pipeline complete
      return null;
    }

    return `${PIPELINE_STAGES[idx + 1]}_PENDING`;
  }
}

export const gatesEngine = new GatesEngine();
