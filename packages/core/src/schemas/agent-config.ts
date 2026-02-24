// ═══════════════════════════════════════════════════════
// Agent Configuration Schema - Phase 1: Model Fallbacks
// ═══════════════════════════════════════════════════════

import { PipelineStage } from './index.js';

/**
 * Model reference format: "provider/model"
 * Examples: "openai/gpt-4o-mini", "claude/claude-3-5-sonnet-20241022"
 */
export type ModelRef = string;

/**
 * Model configuration with fallback support
 */
export type ModelConfig = {
  /** Primary model (provider/model format) */
  primary: ModelRef;
  
  /** Fallback models tried in order if primary fails */
  fallbacks?: ModelRef[];
  
  /** 
   * Fallback strategy:
   * - sequential: Try each fallback in order (default)
   * - priority: Try highest priority first
   * - cost-optimized: Try cheapest available first
   */
  fallbackStrategy?: 'sequential' | 'priority' | 'cost-optimized';
};

/**
 * LLM Provider types
 */
export type LLMProvider = 'openai' | 'kimi' | 'claude' | 'openrouter';

/**
 * Complete agent configuration for pipeline stages
 */
export type AgencyAgentConfig = {
  /** Unique agent identifier (e.g., "intake", "engineer") */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Pipeline stage this agent handles */
  stage: PipelineStage;
  
  /** Model configuration with fallbacks */
  model: ModelConfig;
  
  /** 
   * Primary provider (derived from model.primary)
   * Kept for backward compatibility
   */
  provider: LLMProvider;
  
  /** System prompt for the agent */
  systemPrompt: string;
  
  /** Temperature for generation (0.0 - 1.0) */
  temperature: number;
  
  /** Maximum tokens to generate */
  maxTokens: number;
  
  /** Required artifact types from previous stages */
  requiredInputArtifacts: string[];
  
  /** Artifact types this agent produces */
  outputArtifacts: string[];
  
  /** Whether this agent is active */
  isActive: boolean;
  
  /** Version for tracking config changes */
  version?: string;
};

/**
 * Agent registry containing all agent configurations
 */
export type AgentRegistry = {
  /** Default settings applied to all agents */
  defaults: {
    model: Omit<ModelConfig, 'fallbacks'> & { fallbacks: ModelRef[] };
    temperature: number;
    maxTokens: number;
  };
  
  /** Individual agent configurations */
  agents: AgencyAgentConfig[];
  
  /** Registry version */
  version: string;
};

/**
 * Result of a model execution attempt
 */
export type ModelExecutionResult = 
  | { success: true; content: string; model: ModelRef }
  | { success: false; error: Error; model: ModelRef };

/**
 * Parse a model reference into provider and model name
 * Format: "provider/model" or just "model" (defaults to openai)
 */
export function parseModelRef(modelRef: ModelRef): { provider: LLMProvider; model: string } {
  const parts = modelRef.split('/');
  
  if (parts.length === 2) {
    const provider = parts[0] as LLMProvider;
    return { provider, model: parts[1] };
  }
  
  // Default to openai if no provider specified
  return { provider: 'openai', model: parts[0] };
}

/**
 * Get all models to try in order (primary + fallbacks)
 */
export function getModelsInOrder(config: ModelConfig): ModelRef[] {
  return [config.primary, ...(config.fallbacks || [])];
}

/**
 * Validate a model configuration
 */
export function validateModelConfig(config: ModelConfig): string[] {
  const errors: string[] = [];
  
  if (!config.primary) {
    errors.push('Model config must have a primary model');
  }
  
  const allModels = getModelsInOrder(config);
  for (const modelRef of allModels) {
    try {
      const { provider } = parseModelRef(modelRef);
      const validProviders: LLMProvider[] = ['openai', 'kimi', 'claude', 'openrouter'];
      if (!validProviders.includes(provider)) {
        errors.push(`Invalid provider "${provider}" in model ref "${modelRef}"`);
      }
    } catch {
      errors.push(`Invalid model reference format: "${modelRef}"`);
    }
  }
  
  return errors;
}

/**
 * Find agent config for a pipeline stage
 */
export function findAgentForStage(
  registry: AgentRegistry, 
  stage: PipelineStage
): AgencyAgentConfig | undefined {
  return registry.agents.find(a => a.stage === stage && a.isActive);
}

/**
 * Find agent config by ID
 */
export function findAgentById(
  registry: AgentRegistry,
  id: string
): AgencyAgentConfig | undefined {
  return registry.agents.find(a => a.id === id && a.isActive);
}
