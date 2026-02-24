/**
 * Model Router - Phase 1: Model Fallbacks
 * 
 * Handles LLM calls with automatic fallback to alternative models
 * when the primary model fails.
 */

import {
  ModelConfig,
  ModelRef,
  parseModelRef,
  getModelsInOrder,
  LLMProvider,
  ModelExecutionResult,
} from '@ai-native/core';
import { generateMarkdown, callOpenAI, isOpenAIConfigured, OpenAIConfigError } from './openai.js';
import { kimiGenerateMarkdown, isKimiConfigured, KimiConfigError } from './kimi.js';
import { claudeGenerate, isClaudeConfigured, ClaudeConfigError } from './claude.js';
import { generateWithOpenRouter, isOpenRouterConfigured, OpenRouterConfigError } from './openrouter.js';

export interface GenerateRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelRouterOptions {
  /** Enable verbose logging of fallback attempts */
  verbose?: boolean;
  /** Timeout per model attempt (ms) */
  timeoutMs?: number;
}

export class ModelRouter {
  private verbose: boolean;
  private timeoutMs: number;

  constructor(options: ModelRouterOptions = {}) {
    this.verbose = options.verbose ?? process.env.NODE_ENV === 'development';
    this.timeoutMs = options.timeoutMs ?? 120_000; // 2 minutes default
  }

  /**
   * Execute a generation request with automatic model fallback.
   * Tries models in order: primary → fallbacks
   */
  async generateWithFallback(
    config: ModelConfig,
    request: GenerateRequest
  ): Promise<string> {
    const models = getModelsInOrder(config);
    const results: ModelExecutionResult[] = [];

    for (let i = 0; i < models.length; i++) {
      const modelRef = models[i];
      const isPrimary = i === 0;
      
      this.log(`Trying ${isPrimary ? 'primary' : 'fallback'} model: ${modelRef}`);

      try {
        const result = await this.executeSingleModel(modelRef, request);
        
        if (result.success) {
          this.log(`✓ Success with ${modelRef}`);
          return result.content;
        }
        
        results.push(result);
        this.log(`✗ Failed: ${result.error.message}`);
        
      } catch (error: any) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ success: false, error: err, model: modelRef });
        this.log(`✗ Exception: ${err.message}`);
      }
    }

    // All models failed
    throw this.createAggregateError(results);
  }

  /**
   * Execute a single model call with timeout and error handling
   */
  private async executeSingleModel(
    modelRef: ModelRef,
    request: GenerateRequest
  ): Promise<ModelExecutionResult> {
    const { provider, model } = parseModelRef(modelRef);

    // Check if provider is configured
    const configError = this.checkProviderConfigured(provider);
    if (configError) {
      return {
        success: false,
        error: configError,
        model: modelRef,
      };
    }

    // Execute with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });

    const executionPromise = this.callProvider(provider, model, request);

    try {
      const content = await Promise.race([executionPromise, timeoutPromise]);
      return { success: true, content, model: modelRef };
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        model: modelRef,
      };
    }
  }

  /**
   * Route call to appropriate provider
   */
  private async callProvider(
    provider: LLMProvider,
    model: string,
    request: GenerateRequest
  ): Promise<string> {
    const { system, user, temperature, maxTokens } = request;

    switch (provider) {
      case 'openai':
        return await generateMarkdown({
          system,
          user,
          temperature,
          maxTokens,
          model,
        });

      case 'kimi':
        return await kimiGenerateMarkdown({
          system,
          user,
          temperature,
          maxTokens,
          model,
        });

      case 'claude':
        return await claudeGenerate({
          system,
          user,
          temperature,
          maxTokens,
          model,
        });

      case 'openrouter':
        return await generateWithOpenRouter({
          system,
          user,
          temperature,
          maxTokens,
          model,
        });

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Check if a provider is properly configured
   */
  private checkProviderConfigured(provider: LLMProvider): Error | null {
    switch (provider) {
      case 'openai':
        if (!isOpenAIConfigured()) {
          return new OpenAIConfigError('OPENAI_API_KEY not configured');
        }
        break;
      case 'kimi':
        if (!isKimiConfigured()) {
          return new KimiConfigError('KIMI_API_KEY not configured');
        }
        break;
      case 'claude':
        if (!isClaudeConfigured()) {
          return new ClaudeConfigError('ANTHROPIC_API_KEY not configured');
        }
        break;
      case 'openrouter':
        if (!isOpenRouterConfigured()) {
          return new OpenRouterConfigError('OPENROUTER_API_KEY not configured');
        }
        break;
    }
    return null;
  }

  /**
   * Create a comprehensive error when all models fail
   */
  private createAggregateError(results: ModelExecutionResult[]): Error {
    const failures = results
      .filter((r): r is { success: false; error: Error; model: ModelRef } => !r.success)
      .map(r => `  - ${r.model}: ${r.error.message}`)
      .join('\n');

    return new Error(
      `All models failed to generate response. Attempted:\n${failures}`
    );
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[ModelRouter] ${message}`);
    }
  }

  /**
   * Check which models are available (for health checks)
   */
  getAvailableModels(config: ModelConfig): { available: ModelRef[]; unavailable: ModelRef[] } {
    const models = getModelsInOrder(config);
    const available: ModelRef[] = [];
    const unavailable: ModelRef[] = [];

    for (const modelRef of models) {
      const { provider } = parseModelRef(modelRef);
      const isConfigured = this.checkProviderConfigured(provider) === null;
      
      if (isConfigured) {
        available.push(modelRef);
      } else {
        unavailable.push(modelRef);
      }
    }

    return { available, unavailable };
  }

  /**
   * Validate that at least one model in the config is available
   */
  validateAvailability(config: ModelConfig): { valid: boolean; error?: string } {
    const { available } = this.getAvailableModels(config);
    
    if (available.length === 0) {
      const models = getModelsInOrder(config);
      return {
        valid: false,
        error: `No models available. Check environment variables for: ${models.join(', ')}`,
      };
    }

    return { valid: true };
  }
}

// Singleton instance for convenience
export const modelRouter = new ModelRouter();

// Convenience function for simple use cases
export async function generateWithFallback(
  config: ModelConfig,
  request: GenerateRequest
): Promise<string> {
  return modelRouter.generateWithFallback(config, request);
}
