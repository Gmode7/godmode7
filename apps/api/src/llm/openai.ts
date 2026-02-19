import OpenAI from 'openai';

// Check if key is present and looks like a real OpenAI key (starts with sk-)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const hasOpenAIKey = !!OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-') && OPENAI_API_KEY.length > 20;

if (!hasOpenAIKey) {
  console.warn('[LLM] OPENAI_API_KEY not configured — agent calls will fail gracefully with 503');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder' });
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateMarkdownOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

/**
 * Generate markdown content using OpenAI.
 * Throws OpenAIConfigError if OPENAI_API_KEY is not configured.
 */
export async function generateMarkdown(options: GenerateMarkdownOptions): Promise<string> {
  if (!hasOpenAIKey) {
    throw new OpenAIConfigError('OPENAI_API_KEY not configured');
  }

  const { system, user, temperature = 0.4, maxTokens = 4000, model } = options;

  const messages: LLMMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  try {
    // Try chat.completions API (universally available)
    const res = await client.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const text = res.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from OpenAI');
    return text;
  } catch (err: any) {
    // Sanitize error - never expose API keys
    if (err.message?.includes('API key')) {
      throw new Error('OpenAI authentication failed');
    }
    throw err;
  }
}

/**
 * Legacy helper for backward compatibility with existing intake routes.
 */
export async function callOpenAI(
  systemPrompt: string,
  userText: string,
  history: LLMMessage[] = [],
  model?: string,
): Promise<string> {
  if (!hasOpenAIKey) {
    throw new OpenAIConfigError('OPENAI_API_KEY not configured');
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userText },
  ];

  const res = await client.chat.completions.create({
    model: model || DEFAULT_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 4000,
  });

  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from OpenAI');
  return text;
}

/**
 * Check if OpenAI is configured.
 */
export function isOpenAIConfigured(): boolean {
  return hasOpenAIKey;
}
