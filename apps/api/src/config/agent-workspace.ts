/**
 * Agent Workspace Loader
 * 
 * Loads agent configuration from workspace directory structure:
 * agents/{agentId}/
 *   ├── SOUL.md         # Core personality & values
 *   ├── IDENTITY.md     # Who the agent is
 *   ├── TOOLS.md        # Available tools
 *   ├── VOICE.md        # Writing style
 *   ├── AGENTS.md       # Sub-agent definitions
 *   └── skills/         # Specialized capabilities
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base path for agent workspaces
const AGENTS_BASE_PATH = process.env.AGENTS_WORKSPACE_PATH 
  || path.join(__dirname, '../../../../agents');

export interface AgentWorkspace {
  /** Agent identifier (e.g., "intake", "engineer") */
  agentId: string;
  
  /** Full path to workspace directory */
  workspacePath: string;
  
  /** Core personality and values */
  soul?: string;
  
  /** Identity - who the agent is */
  identity?: string;
  
  /** Available tools and capabilities */
  tools?: string;
  
  /** Writing style guide */
  voice?: string;
  
  /** Sub-agent definitions */
  agents?: string;
  
  /** List of available skills */
  skills: string[];
  
  /** Whether workspace loaded successfully */
  loaded: boolean;
  
  /** Load errors if any */
  errors?: string[];
}

/**
 * Load agent workspace configuration
 */
export async function loadAgentWorkspace(agentId: string): Promise<AgentWorkspace> {
  const workspacePath = path.join(AGENTS_BASE_PATH, agentId);
  
  const workspace: AgentWorkspace = {
    agentId,
    workspacePath,
    skills: [],
    loaded: false,
    errors: [],
  };

  try {
    // Check if workspace exists
    try {
      await fs.access(workspacePath);
    } catch {
      workspace.errors?.push(`Workspace not found: ${workspacePath}`);
      return workspace;
    }

    // Load core markdown files
    const files = [
      { name: 'SOUL.md', key: 'soul' as const },
      { name: 'IDENTITY.md', key: 'identity' as const },
      { name: 'TOOLS.md', key: 'tools' as const },
      { name: 'VOICE.md', key: 'voice' as const },
      { name: 'AGENTS.md', key: 'agents' as const },
    ];

    for (const { name, key } of files) {
      try {
        const content = await fs.readFile(
          path.join(workspacePath, name),
          'utf-8'
        );
        workspace[key] = content;
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          workspace.errors?.push(`Failed to load ${name}: ${err.message}`);
        }
        // File not found is OK - not all agents need all files
      }
    }

    // Load available skills
    try {
      const skillsPath = path.join(workspacePath, 'skills');
      const skillsDir = await fs.readdir(skillsPath, { withFileTypes: true });
      workspace.skills = skillsDir
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch {
      // No skills directory is OK
    }

    workspace.loaded = true;
    
    // Log what we loaded
    const loadedFiles = files.filter(f => workspace[f.key]).map(f => f.name);
    const loadedSkills = workspace.skills.length;
    console.log(
      `[AgentWorkspace] Loaded ${agentId}: ${loadedFiles.join(', ')}` +
      (loadedSkills > 0 ? ` + ${loadedSkills} skills` : '')
    );

  } catch (err: any) {
    workspace.errors?.push(`Unexpected error: ${err.message}`);
  }

  return workspace;
}

/**
 * Load all agent workspaces
 */
export async function loadAllAgentWorkspaces(
  agentIds: string[]
): Promise<Map<string, AgentWorkspace>> {
  const workspaces = new Map<string, AgentWorkspace>();
  
  for (const agentId of agentIds) {
    const workspace = await loadAgentWorkspace(agentId);
    workspaces.set(agentId, workspace);
  }
  
  return workspaces;
}

/**
 * Enhance system prompt with workspace context
 */
export function enhancePromptWithWorkspace(
  baseSystemPrompt: string,
  workspace: AgentWorkspace
): string {
  const parts: string[] = [];
  
  // Start with SOUL if available
  if (workspace.soul) {
    parts.push('# Core Values & Purpose\n');
    parts.push(extractCoreContent(workspace.soul));
    parts.push('\n---\n');
  }
  
  // Add IDENTITY if available
  if (workspace.identity) {
    parts.push('# Who You Are\n');
    parts.push(extractCoreContent(workspace.identity));
    parts.push('\n---\n');
  }
  
  // Add VOICE if available
  if (workspace.voice) {
    parts.push('# Communication Style\n');
    parts.push(extractVoiceGuidelines(workspace.voice));
    parts.push('\n---\n');
  }
  
  // Add base system prompt
  parts.push('# Task Instructions\n');
  parts.push(baseSystemPrompt);
  
  // Add TOOLS summary if available
  if (workspace.tools) {
    parts.push('\n---\n');
    parts.push('# Available Tools\n');
    parts.push(extractToolSummary(workspace.tools));
  }
  
  return parts.join('\n');
}

/**
 * Extract core content from markdown (remove frontmatter if present)
 */
function extractCoreContent(markdown: string): string {
  // Remove YAML frontmatter if present
  if (markdown.startsWith('---')) {
    const end = markdown.indexOf('---', 3);
    if (end !== -1) {
      markdown = markdown.slice(end + 3).trim();
    }
  }
  
  // Remove H1 title (we'll add our own)
  return markdown.replace(/^# .+\n/m, '').trim();
}

/**
 * Extract voice guidelines (condensed)
 */
function extractVoiceGuidelines(voiceMarkdown: string): string {
  const lines = voiceMarkdown.split('\n');
  const guidelines: string[] = [];
  let inRelevantSection = false;
  
  for (const line of lines) {
    // Capture "Do/Don't" sections
    if (line.match(/^##\s*(Do|Don't|Phrase Bank|Writing Patterns)/i)) {
      inRelevantSection = true;
      guidelines.push(line);
    } else if (line.startsWith('## ')) {
      inRelevantSection = false;
    } else if (inRelevantSection) {
      guidelines.push(line);
    }
  }
  
  return guidelines.join('\n').trim() || extractCoreContent(voiceMarkdown);
}

/**
 * Extract tool summary
 */
function extractToolSummary(toolsMarkdown: string): string {
  const lines = toolsMarkdown.split('\n');
  const summary: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Capture tool headers
    if (line.match(/^###?\s+\d+\./)) {
      summary.push(line);
    }
    // Capture purpose lines
    else if (line.match(/^(Purpose|Output):/i)) {
      summary.push(line);
    }
    // Capture capability lists
    else if (line.trim().startsWith('- ') && summary.length > 0) {
      summary.push(line);
    }
  }
  
  return summary.join('\n').trim() || 'See full tools documentation.';
}

/**
 * Check if workspace has specific capability
 */
export function hasCapability(
  workspace: AgentWorkspace,
  capability: string
): boolean {
  if (!workspace.tools) return false;
  
  const lowerTools = workspace.tools.toLowerCase();
  const lowerCap = capability.toLowerCase();
  
  return lowerTools.includes(lowerCap);
}

/**
 * Get list of sub-agents defined in workspace
 */
export function getSubAgents(workspace: AgentWorkspace): string[] {
  if (!workspace.agents) return [];
  
  // Parse AGENTS.md for sub-agent IDs
  const matches = workspace.agents.matchAll(/\*\*ID:\*\*\s*`([^`]+)`/g);
  return Array.from(matches).map(m => m[1]);
}

/**
 * Validate workspace completeness
 */
export function validateWorkspace(
  workspace: AgentWorkspace,
  required: ('soul' | 'identity' | 'tools')[] = []
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const req of required) {
    if (!workspace[req]) {
      missing.push(req);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}
