import { prisma } from '../lib/prisma.js';

/**
 * Get the most recent artifact of a given type for a job.
 * Returns parsed JSON content, or { markdown: rawContent } as fallback.
 */
export async function getArtifactByType(jobId: string, type: string): Promise<any | null> {
  const artifact = await prisma.artifact.findFirst({
    where: { jobId, type },
    orderBy: { createdAt: 'desc' },
  });
  if (!artifact) return null;
  try {
    return JSON.parse(artifact.content);
  } catch {
    return { markdown: artifact.content };
  }
}

/**
 * Get the intake artifact for a job.
 * Prefers intake_brief, falls back to intake_questions.
 */
export async function getIntakeArtifact(jobId: string): Promise<{ type: 'intake_brief' | 'intake_questions' | null; content: any }> {
  const artifacts = await prisma.artifact.findMany({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  });

  const brief = artifacts.find(a => a.type === 'intake_brief');
  if (brief) {
    try {
      return { type: 'intake_brief', content: JSON.parse(brief.content) };
    } catch {
      return { type: 'intake_brief', content: { markdown: brief.content } };
    }
  }

  const questions = artifacts.find(a => a.type === 'intake_questions');
  if (questions) {
    try {
      return { type: 'intake_questions', content: JSON.parse(questions.content) };
    } catch {
      return { type: 'intake_questions', content: { markdown: questions.content } };
    }
  }

  return { type: null, content: null };
}

/**
 * Simplified getIntakeArtifact that returns just the content (no type wrapper).
 * Used by routes that only need the content object.
 */
export async function getIntakeContent(jobId: string): Promise<any | null> {
  const brief = await getArtifactByType(jobId, 'intake_brief');
  if (brief) return brief;
  return await getArtifactByType(jobId, 'intake_questions');
}

/**
 * Get all ADR artifacts for a job.
 */
export async function getAdrArtifacts(jobId: string): Promise<any[]> {
  const artifacts = await prisma.artifact.findMany({
    where: { jobId, type: 'adr' },
    orderBy: { createdAt: 'asc' },
  });
  return artifacts.map(a => {
    try {
      return JSON.parse(a.content);
    } catch {
      return { markdown: a.content };
    }
  });
}
