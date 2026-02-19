import type { AgentConfig } from './agents.js';

/**
 * Build the system + user prompt for an agent, injecting all required input artifacts.
 */
export function buildPrompt(
  agent: AgentConfig,
  artifacts: Record<string, string>,
  brief: string,
): { system: string; user: string } {
  const parts: string[] = [];

  parts.push(`# Project Brief\n${brief}`);

  // Append each required input artifact as a labeled context section
  for (const artifactType of agent.requiredInputArtifacts) {
    const content = artifacts[artifactType];
    if (content) {
      parts.push(`\n## ${artifactType.replace(/_/g, ' ').toUpperCase()}\n${content}`);
    }
  }

  // Also include any other available artifacts as supplementary context
  for (const [type, content] of Object.entries(artifacts)) {
    if (!agent.requiredInputArtifacts.includes(type) && content) {
      parts.push(`\n## ${type.replace(/_/g, ' ').toUpperCase()} (supplementary)\n${content}`);
    }
  }

  return {
    system: agent.systemPrompt,
    user: parts.join('\n'),
  };
}
