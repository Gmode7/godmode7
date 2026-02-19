/**
 * Claude (Anthropic) Client Module
 * Native Anthropic API for coding tasks
 */

export interface ClaudeGenerateOptions {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class ClaudeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeConfigError';
  }
}

// Environment configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

// Validate key presence (Anthropic keys start with sk-ant-)
const hasClaudeKey = !!ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith('sk-ant-');

if (!hasClaudeKey) {
  console.warn('[LLM] ANTHROPIC_API_KEY not configured — engineer agent calls will fail gracefully with 503');
}

interface ClaudeContentBlock {
  type: 'text' | 'thinking' | 'tool_use';
  text?: string;
  thinking?: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: ClaudeContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Generate content using Claude (Anthropic API).
 * Throws ClaudeConfigError if ANTHROPIC_API_KEY is not configured.
 */
export async function claudeGenerate(options: ClaudeGenerateOptions): Promise<string> {
  if (!hasClaudeKey) {
    throw new ClaudeConfigError('ANTHROPIC_API_KEY not configured');
  }

  const { system, user, temperature = 0.3, maxTokens = 8192, model } = options;

  const requestBody: any = {
    model: model || CLAUDE_MODEL,
    messages: [{ role: 'user', content: user }],
    max_tokens: maxTokens,
    temperature,
  };

  // System prompt is a top-level parameter in Anthropic API (not a message)
  if (system) {
    requestBody.system = system;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      // Sanitize error - never expose API keys
      const sanitized = errorMessage.replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');
      throw new Error(`Claude API error: ${sanitized.slice(0, 200)}`);
    }

    const data = await response.json() as ClaudeResponse;
    
    // Extract text content from response
    const textBlocks = data.content
      .filter((block): block is ClaudeContentBlock & { type: 'text'; text: string } => 
        block.type === 'text' && typeof block.text === 'string'
      )
      .map(block => block.text);
    
    const text = textBlocks.join('\n').trim();
    
    if (!text) {
      throw new Error('Empty response from Claude');
    }

    return text;
  } catch (err: any) {
    // Sanitize any fetch or network errors
    if (err.message?.includes('x-api-key') || err.message?.includes('API key')) {
      throw new Error('Claude authentication failed');
    }
    throw err;
  }
}

/**
 * Check if Claude is configured.
 */
export function isClaudeConfigured(): boolean {
  return hasClaudeKey;
}
