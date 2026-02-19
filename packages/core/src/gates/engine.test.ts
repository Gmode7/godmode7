import { describe, it, expect } from 'vitest';
import { GatesEngine } from './engine.js';

const engine = new GatesEngine();

describe('GatesEngine', () => {
  describe('getRequiredGates', () => {
    it('returns gates for strategy A / standard', () => {
      expect(engine.getRequiredGates('A', 'standard')).toEqual([
        'REQUIREMENTS_REVIEW',
        'CODE_REVIEW',
      ]);
    });

    it('returns gates for strategy A / critical', () => {
      expect(engine.getRequiredGates('A', 'critical')).toEqual([
        'REQUIREMENTS_REVIEW',
        'CODE_REVIEW',
        'SECURITY_REVIEW',
        'SBOM_AUDIT',
      ]);
    });

    it('returns empty array for strategy C / standard', () => {
      expect(engine.getRequiredGates('C', 'standard')).toEqual([]);
    });

    it('returns empty array for unknown strategy', () => {
      expect(engine.getRequiredGates('Z', 'standard')).toEqual([]);
    });

    it('returns empty array for unknown risk level', () => {
      expect(engine.getRequiredGates('A', 'unknown')).toEqual([]);
    });
  });

  describe('checkGate', () => {
    it('returns PASS when already passed', () => {
      const existing = [{ gateType: 'CODE_REVIEW', status: 'PASS' as const }];
      const result = engine.checkGate('CODE_REVIEW', [], existing);
      expect(result.status).toBe('PASS');
    });

    it('returns PASS when required artifacts are present', () => {
      const artifacts = [{ type: 'CODE_SNAPSHOT' }];
      const result = engine.checkGate('CODE_REVIEW', artifacts, []);
      expect(result.status).toBe('PASS');
    });

    it('returns FAIL when required artifacts are missing', () => {
      const result = engine.checkGate('CODE_REVIEW', [], []);
      expect(result.status).toBe('FAIL');
      expect(result.reason).toContain('CODE_SNAPSHOT');
    });

    it('returns PASS for pipeline stage gate with artifacts', () => {
      const artifacts = [{ type: 'prd' }, { type: 'backlog' }];
      const result = engine.checkGate('PM_DONE', artifacts, []);
      expect(result.status).toBe('PASS');
    });

    it('returns FAIL for pipeline stage gate with missing artifacts', () => {
      const artifacts = [{ type: 'prd' }];
      const result = engine.checkGate('PM_DONE', artifacts, []);
      expect(result.status).toBe('FAIL');
      expect(result.reason).toContain('backlog');
    });

    it('returns PASS for unknown gate type (no requirements)', () => {
      const result = engine.checkGate('UNKNOWN_GATE', [], []);
      expect(result.status).toBe('PASS');
    });
  });

  describe('checkStageGate', () => {
    it('passes when all artifacts are present', () => {
      const result = engine.checkStageGate('INTAKE', ['intake_brief']);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('fails when artifacts are missing', () => {
      const result = engine.checkStageGate('PM', ['prd']);
      expect(result.passed).toBe(false);
      expect(result.missing).toEqual(['backlog']);
    });

    it('passes for unknown stage (no requirements)', () => {
      const result = engine.checkStageGate('UNKNOWN', []);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('getNextStage', () => {
    it('returns PM_PENDING after INTAKE_DONE', () => {
      expect(engine.getNextStage('INTAKE_DONE')).toBe('PM_PENDING');
    });

    it('returns ARCH_PENDING after PM_DONE', () => {
      expect(engine.getNextStage('PM_DONE')).toBe('ARCH_PENDING');
    });

    it('returns null after DOCS_DONE (last stage)', () => {
      expect(engine.getNextStage('DOCS_DONE')).toBeNull();
    });

    it('returns null for non-DONE states', () => {
      expect(engine.getNextStage('INTAKE_RUNNING')).toBeNull();
    });

    it('returns null for COMPLETED', () => {
      expect(engine.getNextStage('COMPLETED')).toBeNull();
    });

    it('returns null for unknown state', () => {
      expect(engine.getNextStage('BOGUS_DONE')).toBeNull();
    });
  });

  describe('getValidTransitions', () => {
    it('returns allowed transitions when gates are met', () => {
      const transitions = engine.getValidTransitions(
        'PENDING_REQUIREMENTS',
        'A',
        'standard',
        ['REQUIREMENTS_REVIEW'],
      );
      expect(transitions).toEqual([
        { state: 'REQUIREMENTS_COMPLETE', allowed: true, missingGates: [] },
      ]);
    });

    it('returns blocked transitions when gates are missing', () => {
      const transitions = engine.getValidTransitions(
        'PENDING_REQUIREMENTS',
        'A',
        'standard',
        [],
      );
      expect(transitions).toEqual([
        {
          state: 'REQUIREMENTS_COMPLETE',
          allowed: false,
          missingGates: ['REQUIREMENTS_REVIEW'],
        },
      ]);
    });

    it('returns empty array for terminal state', () => {
      const transitions = engine.getValidTransitions('COMPLETED', 'A', 'standard', []);
      expect(transitions).toEqual([]);
    });

    it('allows transitions without gate requirements', () => {
      const transitions = engine.getValidTransitions(
        'PENDING_REQUIREMENTS',
        'C',
        'standard',
        [],
      );
      expect(transitions).toEqual([
        { state: 'REQUIREMENTS_COMPLETE', allowed: true, missingGates: [] },
      ]);
    });
  });

  describe('getGateDefinitions', () => {
    it('returns an array of gate definitions', () => {
      const defs = engine.getGateDefinitions();
      expect(Array.isArray(defs)).toBe(true);
      expect(defs.length).toBeGreaterThan(0);
    });

    it('each definition has type, description, and requiresArtifacts', () => {
      const defs = engine.getGateDefinitions();
      for (const def of defs) {
        expect(def).toHaveProperty('type');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('requiresArtifacts');
        expect(Array.isArray(def.requiresArtifacts)).toBe(true);
      }
    });
  });
});
