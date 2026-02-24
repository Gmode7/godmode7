import { prisma } from '../lib/prisma.js';
import { hashApiKey, gatesEngine, PIPELINE_STAGES } from '@ai-native/core';
import { generateMarkdown, callOpenAI } from '../llm/openai.js';
import { kimiGenerateMarkdown } from '../llm/kimi.js';
import { claudeGenerate } from '../llm/claude.js';
import { modelRouter } from '../llm/model-router.js';
import { getAgentForStage } from './agents.js';
import { buildPrompt } from './prompt-builder.js';
import { emitPipelineEvent } from './events.js';

const ARTIFACT_REGEX = /<artifact type="([^"]+)">([\s\S]*?)<\/artifact>/g;
const MAX_RETRIES = 2;

// In-memory retry counters per job+stage
const retryCounts = new Map<string, number>();

function retryKey(jobId: string, stage: string): string {
  return `${jobId}:${stage}`;
}

export class Orchestrator {
  /**
   * Start the full pipeline for a job.
   */
  async startPipeline(jobId: string): Promise<void> {
    // Set initial state
    await prisma.job.update({
      where: { id: jobId },
      data: { currentState: 'INTAKE_PENDING' },
    });

    // Clear any prior retry counts for this job
    for (const stage of PIPELINE_STAGES) {
      retryCounts.delete(retryKey(jobId, stage));
    }

    await this.executeStage(jobId, 'INTAKE');
  }

  /**
   * Execute a single pipeline stage.
   */
  async executeStage(jobId: string, stage: string): Promise<void> {
    const agent = getAgentForStage(stage);
    if (!agent) {
      throw new Error(`No agent config for stage: ${stage}`);
    }

    try {
      // 1. Update to *_RUNNING
      await prisma.job.update({
        where: { id: jobId },
        data: { currentState: `${stage}_RUNNING` },
      });
      emitPipelineEvent({
        jobId, type: 'stage_started', stage,
        timestamp: new Date().toISOString(),
      });

      // 2. Load all prior artifacts from DB
      const dbArtifacts = await prisma.artifact.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      });

      // Dedupe by type (latest first)
      const artifactMap: Record<string, string> = {};
      for (const a of dbArtifacts) {
        if (!artifactMap[a.type]) {
          try {
            const parsed = JSON.parse(a.content);
            artifactMap[a.type] = parsed.markdown || a.content;
          } catch {
            artifactMap[a.type] = a.content;
          }
        }
      }

      // 3. Get the project brief (from intake_questions artifact or first artifact content)
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { artifacts: { where: { type: 'intake_questions' }, take: 1 } },
      });
      let brief = '';
      if (job?.artifacts[0]) {
        try {
          const parsed = JSON.parse(job.artifacts[0].content);
          brief = parsed.markdown || parsed.idea || job.artifacts[0].content;
        } catch {
          brief = job.artifacts[0].content;
        }
      }

      // 4. Build prompt
      const { system, user } = buildPrompt(agent, artifactMap, brief);

      // 5. Call LLM with model fallback support (Phase 1)
      let llmResponse: string;
      
      // Check if agent has new model config with fallbacks
      if (agent.model && Array.isArray(agent.model.fallbacks)) {
        // Use ModelRouter for automatic fallback
        llmResponse = await modelRouter.generateWithFallback(
          agent.model,
          {
            system,
            user,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
          }
        );
      } else {
        // Legacy: Direct provider call (backward compatibility)
        switch (agent.provider) {
          case 'openai':
            if (stage === 'INTAKE') {
              llmResponse = await callOpenAI(system, user);
            } else {
              llmResponse = await generateMarkdown({
                system,
                user,
                temperature: agent.temperature,
                maxTokens: agent.maxTokens,
              });
            }
            break;
          case 'kimi':
            llmResponse = await kimiGenerateMarkdown({
              system,
              user,
              temperature: agent.temperature,
              maxTokens: agent.maxTokens,
            });
            break;
          case 'claude':
            llmResponse = await claudeGenerate({
              system,
              user,
              temperature: agent.temperature,
              maxTokens: agent.maxTokens,
            });
            break;
          default:
            throw new Error(`Unknown provider: ${agent.provider}`);
        }
      }

      // 6. Parse XML response into artifacts
      const parsedArtifacts: Array<{ type: string; content: string }> = [];
      let match: RegExpExecArray | null;
      const regex = new RegExp(ARTIFACT_REGEX.source, ARTIFACT_REGEX.flags);
      while ((match = regex.exec(llmResponse)) !== null) {
        parsedArtifacts.push({
          type: match[1].trim(),
          content: match[2].trim(),
        });
      }

      // If no XML artifacts found, wrap entire response as the first expected output
      if (parsedArtifacts.length === 0 && agent.outputArtifacts.length > 0) {
        parsedArtifacts.push({
          type: agent.outputArtifacts[0],
          content: llmResponse.trim(),
        });
      }

      // 7. Save each artifact to DB
      for (const artifact of parsedArtifacts) {
        const payload = JSON.stringify({
          markdown: artifact.content,
          source: `${stage.toLowerCase()}_pipeline`,
        });
        await prisma.artifact.create({
          data: {
            jobId,
            type: artifact.type,
            content: payload,
            hash: hashApiKey(payload),
          },
        });
        emitPipelineEvent({
          jobId, type: 'artifact_created', stage,
          data: { artifactType: artifact.type },
          timestamp: new Date().toISOString(),
        });
      }

      // 8. Check stage gate
      const savedTypes = parsedArtifacts.map(a => a.type);
      // Also include previously saved artifacts
      const allArtifactTypes = [...new Set([...Object.keys(artifactMap), ...savedTypes])];
      const gateResult = gatesEngine.checkStageGate(stage, allArtifactTypes);

      emitPipelineEvent({
        jobId, type: 'gate_checked', stage,
        data: { passed: gateResult.passed, missing: gateResult.missing },
        timestamp: new Date().toISOString(),
      });

      // 9. Update to *_DONE
      await prisma.job.update({
        where: { id: jobId },
        data: { currentState: `${stage}_DONE` },
      });
      emitPipelineEvent({
        jobId, type: 'stage_completed', stage,
        timestamp: new Date().toISOString(),
      });

      // 10. Advance to next stage
      await this.advanceJob(jobId);
    } catch (error: any) {
      await this.handleFailure(jobId, stage, error);
    }
  }

  /**
   * Advance the job to the next pipeline stage.
   */
  async advanceJob(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const nextState = gatesEngine.getNextStage(job.currentState);

    if (!nextState) {
      // Pipeline complete
      await prisma.job.update({
        where: { id: jobId },
        data: { currentState: 'COMPLETED' },
      });
      emitPipelineEvent({
        jobId, type: 'pipeline_completed',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // nextState is like 'PM_PENDING' — extract stage prefix
    const nextStage = nextState.replace('_PENDING', '');
    await prisma.job.update({
      where: { id: jobId },
      data: { currentState: nextState },
    });

    await this.executeStage(jobId, nextStage);
  }

  /**
   * Handle a stage failure with retry logic.
   */
  async handleFailure(jobId: string, stage: string, error: Error): Promise<void> {
    console.error(`[orchestrator] Stage ${stage} failed for job ${jobId}:`, error.message);

    // Set to *_FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: { currentState: `${stage}_FAILED` },
    });
    emitPipelineEvent({
      jobId, type: 'stage_failed', stage,
      data: { error: error.message },
      timestamp: new Date().toISOString(),
    });

    // Check retry count
    const key = retryKey(jobId, stage);
    const count = retryCounts.get(key) || 0;

    if (count < MAX_RETRIES) {
      retryCounts.set(key, count + 1);
      console.log(`[orchestrator] Retrying stage ${stage} for job ${jobId} (attempt ${count + 1}/${MAX_RETRIES})`);

      // Reset to *_PENDING and retry
      await prisma.job.update({
        where: { id: jobId },
        data: { currentState: `${stage}_PENDING` },
      });
      await this.executeStage(jobId, stage);
    } else {
      console.error(`[orchestrator] Max retries exceeded for stage ${stage}, job ${jobId}`);
    }
  }

  /**
   * Retry a specific failed stage manually.
   */
  async retryStage(jobId: string, stage: string): Promise<void> {
    // Reset retry counter
    retryCounts.delete(retryKey(jobId, stage));

    await prisma.job.update({
      where: { id: jobId },
      data: { currentState: `${stage}_PENDING` },
    });

    await this.executeStage(jobId, stage);
  }
}

export const orchestrator = new Orchestrator();
