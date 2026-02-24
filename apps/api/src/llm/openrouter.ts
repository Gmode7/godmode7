/**
 * OpenRouter Client - Free tier LLM access
 * 
 * OpenRouter provides an OpenAI-compatible API for accessing free models
 * including Gemma, Llama, and Hermes.
 * 
 * Website: https://openrouter.ai
 * Docs: https://openrouter.ai/docs
 */

import OpenAI from 'openai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const hasOpenRouterKey = !!OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 20;

if (!hasOpenRouterKey) {
  console.warn('[LLM] OPENROUTER_API_KEY not configured — free model calls will fail gracefully with 503');
}

// OpenRouter uses OpenAI-compatible API with different base URL
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || 'sk-or-placeholder',
  baseURL: 'https://openrouter.ai/api/v1',
});

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

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterConfigError';
  }
}

/**
 * Generate content using OpenRouter.
 * Throws OpenRouterConfigError if OPENROUTER_API_KEY is not configured.
 */
export async function generateWithOpenRouter(options: GenerateMarkdownOptions): Promise<string> {
  if (!hasOpenRouterKey) {
    throw new OpenRouterConfigError('OPENROUTER_API_KEY not configured');
  }

  const { system, user, temperature = 0.4, maxTokens = 4000, model } = options;

  const messages: LLMMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  try {
    const res = await client.chat.completions.create({
      model: model || 'google/gemma-3-4b-it',
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const text = res.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from OpenRouter');
    return text;
  } catch (err: any) {
    // Sanitize error - never expose API keys
    if (err.message?.includes('API key')) {
      throw new Error('OpenRouter authentication failed');
    }
    throw err;
  }
}

/**
 * Check if OpenRouter is configured.
 */
export function isOpenRouterConfigured(): boolean {
  return hasOpenRouterKey;
}

/**
 * Get available free models on OpenRouter
 * These are the models configured in agents.yaml
 */
export const FREE_MODELS = {
  // Google Gemma 3 family
  'google/gemma-3-4b-it': { name: 'Gemma 3 4B', context: '33000', useCase: 'QA Agent - Fast test generation' },
  'google/gemma-3-12b-it': { name: 'Gemma 3 12B', context: '33000', useCase: 'Engineer Agent - Code generation' },
  'google/gemma-3-27b-it': { name: 'Gemma 3 27B', context: '131000', useCase: 'PM/Security - Reasoning & analysis' },
  
  // Meta Llama family
  'meta-llama/llama-3.2-3b-instruct': { name: 'Llama 3.2 3B', context: '131000', useCase: 'Docs Agent - Lightweight writing' },
  'meta-llama/llama-3.3-70b-instruct': { name: 'Llama 3.3 70B', context: '128000', useCase: 'Intake Agent - Dialogue & multilingual' },
  
  // Nous Hermes (frontier model)
  'nousresearch/hermes-3-405b-instruct': { name: 'Hermes 3 405B', context: '131000', useCase: 'Architect Agent - Deep reasoning' },
} as const;
