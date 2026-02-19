import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  clientId: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
});

export const CreateJobSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  strategy: z.string().max(50).default('A'),
  riskClassification: z.string().max(50).default('standard'),
});

export const TransitionSchema = z.object({
  targetState: z.string().min(1, 'targetState is required'),
});

export const GateCheckSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  gateType: z.string().min(1, 'gateType is required'),
});

export const CreateArtifactSchema = z.object({
  type: z.string().min(1, 'type is required').max(100),
  jobId: z.string().min(1, 'jobId is required'),
  content: z.unknown(),
});

export const ChatMessageSchema = z.object({
  content: z.string().min(1, 'content is required').max(10000),
});
