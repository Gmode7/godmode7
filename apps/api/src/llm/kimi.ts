/**
 * Kimi (Moonshot AI) Client Module
 * OpenAI-compatible API for long document generation
 */

export interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KimiGenerateOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class KimiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KimiConfigError';
  }
}

// Environment configuration
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-latest';

// Validate key presence (basic check)
const hasKimiKey = !!KIMI_API_KEY && KIMI_API_KEY.length > 10;

if (!hasKimiKey) {
  console.warn('[LLM] KIMI_API_KEY not configured — tech lead agent calls will fail gracefully with 503');
}

interface KimiCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate markdown content using Kimi (Moonshot AI).
 * Throws KimiConfigError if KIMI_API_KEY is not configured.
 */
export async function kimiGenerateMarkdown(options: KimiGenerateOptions): Promise<string> {
  if (!hasKimiKey) {
    throw new KimiConfigError('KIMI_API_KEY not configured');
  }

  const { system, user, temperature = 0.4, maxTokens = 8000, model } = options;

  const messages: KimiMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  const requestBody = {
    model: model || KIMI_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  try {
    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // Sanitize error - never expose API keys
      const sanitized = errorText.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
      throw new Error(`Kimi API error: ${response.status} - ${sanitized.slice(0, 200)}`);
    }

    const data = await response.json() as KimiCompletionResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    
    if (!text) {
      throw new Error('Empty response from Kimi');
    }

    return text;
  } catch (err: any) {
    // Sanitize any fetch or network errors
    if (err.message?.includes('API key') || err.message?.includes('Bearer')) {
      throw new Error('Kimi authentication failed');
    }
    throw err;
  }
}

/**
 * Check if Kimi is configured.
 */
export function isKimiConfigured(): boolean {
  return hasKimiKey;
}
