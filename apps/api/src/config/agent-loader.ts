/**
 * Agent Configuration Loader
 * 
 * Loads agent configurations from YAML file with hot-reload support.
 * Falls back to built-in defaults if config file is missing.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import {
  AgentRegistry,
  AgencyAgentConfig,
  PipelineStage,
  PIPELINE_STAGES,
  validateModelConfig,
  findAgentForStage,
} from '@ai-native/core';
import {
  loadAgentWorkspace,
  enhancePromptWithWorkspace,
  AgentWorkspace,
} from './agent-workspace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default config paths (in order of priority)
const CONFIG_PATHS = [
  process.env.AGENT_CONFIG_PATH, // Explicit env var
  './config/agents.yaml',        // Project root
  './agents.yaml',               // Simple name
  path.join(__dirname, '../../../config/agents.yaml'), // Relative to this file
].filter(Boolean) as string[];

/**
 * Default agent configurations (fallback if no YAML)
 * These are the original hardcoded configs enhanced with fallback support
 */
export const DEFAULT_AGENT_REGISTRY: AgentRegistry = {
  version: '1.0.0',
  defaults: {
    model: {
      primary: 'openai/gpt-4o-mini',
      fallbacks: ['kimi/kimi-latest'],
    },
    temperature: 0.3,
    maxTokens: 4000,
  },
  agents: [
    {
      id: 'intake',
      name: 'Intake / Account Manager',
      stage: 'INTAKE',
      model: {
        primary: 'openai/gpt-4o-mini',
        fallbacks: ['kimi/kimi-latest'],
      },
      provider: 'openai',
      systemPrompt: `You are the Intake / Account Manager at GM7, a world-class AI software agency.
Your job: ask the client concise, high-signal clarifying questions about their project idea.

Rules:
- Ask 7–12 numbered questions.
- Cover: target users, core problem, must-have features, nice-to-haves, existing systems/integrations, timeline, budget range, technical constraints, success metrics, non-goals.
- Friendly but professional. No filler. No rambling.
- Output clean Markdown starting with "## Intake Questionnaire".
- End with: "Please answer each question. Once we receive your answers we will produce your Intake Brief."`,
      temperature: 0.4,
      maxTokens: 4000,
      requiredInputArtifacts: [],
      outputArtifacts: ['intake_brief'],
      isActive: true,
    },
    {
      id: 'pm',
      name: 'Product Manager',
      stage: 'PM',
      model: {
        primary: 'openai/gpt-4o-mini',
        fallbacks: ['openai/gpt-4o', 'kimi/kimi-latest'],
      },
      provider: 'openai',
      systemPrompt: `You are the Product Manager at GM7, a world-class AI software agency.
Your job: produce a comprehensive Product Requirements Document (PRD) and Product Backlog.

Output MUST use XML artifact tags. Produce exactly two artifacts:

<artifact type="prd">
# Product Requirements Document
...
</artifact>

<artifact type="backlog">
# Product Backlog
...
</artifact>

Rules:
- Be specific and actionable.
- Base everything on the provided context. Do not invent features.
- Target 1000-1500 words per artifact.
- Professional, clear tone.`,
      temperature: 0.4,
      maxTokens: 6000,
      requiredInputArtifacts: ['intake_brief'],
      outputArtifacts: ['prd', 'backlog'],
      isActive: true,
    },
    {
      id: 'architect',
      name: 'Tech Lead / Architect',
      stage: 'ARCH',
      model: {
        primary: 'claude/claude-3-5-sonnet-20241022',
        fallbacks: ['openai/gpt-4o', 'kimi/kimi-latest'],
      },
      provider: 'claude',
      systemPrompt: `You are the Tech Lead / Architect at GM7, a world-class AI software agency.
Your job: produce an Architecture Document and Architecture Decision Records.

Output MUST use XML artifact tags. Produce exactly two artifacts:

<artifact type="architecture">
# Architecture Document
...
</artifact>

<artifact type="adr">
# ADR-0001: Key Architecture Decisions
...
</artifact>

Rules:
- Be specific and actionable. Include concrete numbers.
- Production-grade thinking. Consider failure modes.
- Target 1500-2500 words for architecture, 500-800 for ADR.
- Professional, clear tone.`,
      temperature: 0.3,
      maxTokens: 8000,
      requiredInputArtifacts: ['prd', 'backlog'],
      outputArtifacts: ['architecture', 'adr'],
      isActive: true,
    },
    {
      id: 'engineer',
      name: 'Software Engineer',
      stage: 'ENG',
      model: {
        primary: 'claude/claude-3-5-sonnet-20241022',
        fallbacks: ['openai/gpt-4o', 'kimi/kimi-latest'],
      },
      provider: 'claude',
      systemPrompt: `You are a Senior Software Engineer at GM7, a world-class AI software agency.
Your job: create a detailed engineering plan and a unified diff patch.

Output MUST use XML artifact tags. Produce exactly two artifacts:

<artifact type="engineering_plan">
# Engineering Plan
...
</artifact>

<artifact type="patch">
diff --git a/src/example.ts b/src/example.ts
...
</artifact>

Rules:
- Be specific and actionable. Include concrete file paths and function names.
- Production-grade code quality. Consider error handling.
- Target 1000-2000 words for plan, valid unified diff for patch.
- Professional, clear tone.`,
      temperature: 0.3,
      maxTokens: 8192,
      requiredInputArtifacts: ['architecture', 'adr', 'backlog'],
      outputArtifacts: ['engineering_plan', 'patch'],
      isActive: true,
    },
    {
      id: 'qa',
      name: 'QA Engineer',
      stage: 'QA',
      model: {
        primary: 'openai/gpt-4o-mini',
        fallbacks: ['openai/gpt-4o'],
      },
      provider: 'openai',
      systemPrompt: `You are a Senior QA Engineer at GM7, a world-class AI software agency.
Your job: create a test plan, QA test matrix, and QA report.

Output MUST use XML artifact tags. Produce exactly three artifacts:

<artifact type="test_plan">...</artifact>
<artifact type="qa_matrix">...</artifact>
<artifact type="qa_report">...</artifact>

Rules:
- Be specific with test case descriptions.
- Cover both happy path and failure modes.
- Target 800-1500 words per artifact.
- Professional, clear tone.`,
      temperature: 0.3,
      maxTokens: 6000,
      requiredInputArtifacts: ['prd', 'patch', 'engineering_plan'],
      outputArtifacts: ['test_plan', 'qa_matrix', 'qa_report'],
      isActive: true,
    },
    {
      id: 'security',
      name: 'Security Auditor',
      stage: 'SEC',
      model: {
        primary: 'openai/gpt-4o-mini',
        fallbacks: ['claude/claude-3-5-sonnet-20241022'],
      },
      provider: 'openai',
      systemPrompt: `You are a Security Architect at GM7, a world-class AI software agency.
Your job: create a threat model and security findings report.

Output MUST use XML artifact tags. Produce exactly two artifacts:

<artifact type="threat_model">...</artifact>
<artifact type="security_findings">...</artifact>

Rules:
- Be specific to the system described in the artifacts.
- Prioritize realistic threats over theoretical ones.
- Target 1500-2500 words for threat model, 1000-2000 for findings.
- Professional, security-focused tone.`,
      temperature: 0.3,
      maxTokens: 6000,
      requiredInputArtifacts: ['architecture', 'patch'],
      outputArtifacts: ['threat_model', 'security_findings'],
      isActive: true,
    },
    {
      id: 'docs',
      name: 'Technical Writer',
      stage: 'DOCS',
      model: {
        primary: 'kimi/kimi-latest',
        fallbacks: ['openai/gpt-4o', 'openai/gpt-4o-mini'],
      },
      provider: 'kimi',
      systemPrompt: `You are a Technical Writer at GM7, a world-class AI software agency.
Your job: create API documentation and a README.

Output MUST use XML artifact tags. Produce exactly two artifacts:

<artifact type="docs_api">...</artifact>
<artifact type="docs_readme">...</artifact>

Rules:
- Clear, professional tone.
- Code examples should be copy-paste ready.
- Target 1000-2000 words per artifact.
- Output MUST use the XML artifact tags shown above.`,
      temperature: 0.4,
      maxTokens: 8000,
      requiredInputArtifacts: ['prd', 'architecture', 'engineering_plan'],
      outputArtifacts: ['docs_api', 'docs_readme'],
      isActive: true,
    },
  ],
};

class AgentConfigLoader {
  private registry: AgentRegistry | null = null;
  private configPath: string | null = null;
  private lastLoadTime: number = 0;
  private readonly reloadIntervalMs = 5000; // Check for changes every 5s in dev

  /**
   * Load agent configuration from file or use defaults
   */
  async load(): Promise<AgentRegistry> {
    // Try to load from file
    for (const configPath of CONFIG_PATHS) {
      try {
        const stats = await fs.stat(configPath);
        if (stats.isFile()) {
          const content = await fs.readFile(configPath, 'utf-8');
          const parsed = yaml.parse(content);
          
          // Validate and normalize
          this.registry = this.validateAndNormalize(parsed);
          this.configPath = configPath;
          this.lastLoadTime = Date.now();
          
          console.log(`[AgentConfig] Loaded from ${configPath}`);
          console.log(`[AgentConfig] Loaded ${this.registry.agents.length} agents`);
          
          return this.registry;
        }
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.warn(`[AgentConfig] Failed to load ${configPath}:`, err.message);
        }
        // Continue to next path
      }
    }

    // Fall back to defaults
    console.log('[AgentConfig] Using default configuration');
    this.registry = DEFAULT_AGENT_REGISTRY;
    return this.registry;
  }

  /**
   * Get the current registry (loads if not loaded)
   */
  async getRegistry(): Promise<AgentRegistry> {
    if (!this.registry) {
      return this.load();
    }
    return this.registry;
  }

  /**
   * Get agent config for a specific stage
   */
  async getAgentForStage(stage: PipelineStage): Promise<AgencyAgentConfig | undefined> {
    const registry = await this.getRegistry();
    return findAgentForStage(registry, stage);
  }

  /**
   * Get all active agents
   */
  async getActiveAgents(): Promise<AgencyAgentConfig[]> {
    const registry = await this.getRegistry();
    return registry.agents.filter(a => a.isActive);
  }

  /**
   * Validate and normalize a loaded registry
   */
  private validateAndNormalize(parsed: any): AgentRegistry {
    const errors: string[] = [];

    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Config must be an object');
    }

    // Validate agents array
    if (!Array.isArray(parsed.agents)) {
      throw new Error('Config must have an "agents" array');
    }

    // Validate each agent
    const validatedAgents: AgencyAgentConfig[] = [];
    const seenIds = new Set<string>();
    const seenStages = new Set<PipelineStage>();

    for (let i = 0; i < parsed.agents.length; i++) {
      const agent = parsed.agents[i];
      const agentErrors = this.validateAgent(agent, i);
      
      if (agentErrors.length > 0) {
        errors.push(...agentErrors);
        continue;
      }

      // Check for duplicates
      if (seenIds.has(agent.id)) {
        errors.push(`Agent ${i}: Duplicate ID "${agent.id}"`);
        continue;
      }
      if (seenStages.has(agent.stage)) {
        errors.push(`Agent ${i}: Duplicate stage "${agent.stage}"`);
        continue;
      }

      seenIds.add(agent.id);
      seenStages.add(agent.stage);
      
      // Normalize with defaults
      validatedAgents.push(this.normalizeAgent(agent, parsed.defaults));
    }

    // Ensure all pipeline stages have an agent
    for (const stage of PIPELINE_STAGES) {
      if (!seenStages.has(stage)) {
        errors.push(`Missing agent for pipeline stage: ${stage}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Config validation failed:\n${errors.join('\n')}`);
    }

    return {
      version: parsed.version || '1.0.0',
      defaults: parsed.defaults || DEFAULT_AGENT_REGISTRY.defaults,
      agents: validatedAgents,
    };
  }

  /**
   * Validate a single agent configuration
   */
  private validateAgent(agent: any, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Agent ${index} (${agent?.id || 'unknown'})`;

    if (!agent || typeof agent !== 'object') {
      return [`${prefix}: Must be an object`];
    }

    // Required fields
    if (!agent.id || typeof agent.id !== 'string') {
      errors.push(`${prefix}: Must have a string "id"`);
    }

    if (!agent.name || typeof agent.name !== 'string') {
      errors.push(`${prefix}: Must have a string "name"`);
    }

    if (!PIPELINE_STAGES.includes(agent.stage)) {
      errors.push(`${prefix}: Invalid stage "${agent.stage}"`);
    }

    // Model config
    if (!agent.model || typeof agent.model !== 'object') {
      errors.push(`${prefix}: Must have a "model" object`);
    } else {
      const modelErrors = validateModelConfig(agent.model);
      errors.push(...modelErrors.map(e => `${prefix}: ${e}`));
    }

    // System prompt
    if (!agent.systemPrompt || typeof agent.systemPrompt !== 'string') {
      errors.push(`${prefix}: Must have a string "systemPrompt"`);
    }

    // Artifacts
    if (!Array.isArray(agent.requiredInputArtifacts)) {
      errors.push(`${prefix}: "requiredInputArtifacts" must be an array`);
    }

    if (!Array.isArray(agent.outputArtifacts)) {
      errors.push(`${prefix}: "outputArtifacts" must be an array`);
    }

    return errors;
  }

  /**
   * Normalize an agent with default values
   */
  private normalizeAgent(agent: any, defaults: any): AgencyAgentConfig {
    return {
      id: agent.id,
      name: agent.name,
      stage: agent.stage,
      model: {
        primary: agent.model.primary,
        fallbacks: agent.model.fallbacks || defaults?.model?.fallbacks || [],
        fallbackStrategy: agent.model.fallbackStrategy || 'sequential',
      },
      provider: this.deriveProvider(agent.model.primary),
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature ?? defaults?.temperature ?? 0.3,
      maxTokens: agent.maxTokens ?? defaults?.maxTokens ?? 4000,
      requiredInputArtifacts: agent.requiredInputArtifacts || [],
      outputArtifacts: agent.outputArtifacts || [],
      isActive: agent.isActive ?? true,
      version: agent.version || '1.0.0',
    };
  }

  /**
   * Derive provider from model reference
   */
  private deriveProvider(modelRef: string): 'openai' | 'kimi' | 'claude' {
    const provider = modelRef.split('/')[0];
    if (['openai', 'kimi', 'claude'].includes(provider)) {
      return provider as 'openai' | 'kimi' | 'claude';
    }
    return 'openai'; // Default
  }

  /**
   * Reload configuration (useful for hot-reload in development)
   */
  async reload(): Promise<AgentRegistry> {
    this.registry = null;
    return this.load();
  }
}

// Workspace cache
const workspaceCache = new Map<string, AgentWorkspace>();

/**
 * Load agent configuration with workspace enhancement
 * This combines YAML config with workspace SOUL.md, IDENTITY.md, etc.
 */
export async function loadAgentWithWorkspace(
  agentId: string
): Promise<{ config: AgencyAgentConfig | undefined; workspace: AgentWorkspace }> {
  // Load base config
  const registry = await agentConfigLoader.getRegistry();
  const config = registry.agents.find(a => a.id === agentId && a.isActive);
  
  // Load or get cached workspace
  let workspace = workspaceCache.get(agentId);
  if (!workspace) {
    workspace = await loadAgentWorkspace(agentId);
    workspaceCache.set(agentId, workspace);
  }
  
  if (!config) {
    return { config: undefined, workspace };
  }
  
  // Enhance system prompt with workspace if available
  if (workspace.loaded) {
    const enhancedPrompt = enhancePromptWithWorkspace(
      config.systemPrompt,
      workspace
    );
    
    return {
      config: {
        ...config,
        systemPrompt: enhancedPrompt,
      },
      workspace,
    };
  }
  
  return { config, workspace };
}

/**
 * Get agent for stage with workspace enhancement
 */
export async function getAgentForStageWithWorkspace(
  stage: PipelineStage
): Promise<{ config: AgencyAgentConfig | undefined; workspace: AgentWorkspace }> {
  const registry = await agentConfigLoader.getRegistry();
  const config = findAgentForStage(registry, stage);
  
  if (!config) {
    const workspace = await loadAgentWorkspace('unknown');
    return { config: undefined, workspace };
  }
  
  return loadAgentWithWorkspace(config.id);
}

/**
 * Clear workspace cache (useful for development)
 */
export function clearWorkspaceCache(): void {
  workspaceCache.clear();
}

// Singleton instance
export const agentConfigLoader = new AgentConfigLoader();

// Convenience exports
export async function loadAgentConfig(): Promise<AgentRegistry> {
  return agentConfigLoader.load();
}

export async function getAgentForStage(stage: PipelineStage): Promise<AgencyAgentConfig | undefined> {
  return agentConfigLoader.getAgentForStage(stage);
}

export async function getActiveAgents(): Promise<AgencyAgentConfig[]> {
  return agentConfigLoader.getActiveAgents();
}
