import { EventEmitter } from 'events';

export type PipelineEventType =
  | 'stage_started'
  | 'stage_completed'
  | 'stage_failed'
  | 'gate_checked'
  | 'pipeline_completed'
  | 'artifact_created';

export interface PipelineEvent {
  jobId: string;
  type: PipelineEventType;
  stage?: string;
  data?: any;
  timestamp: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100); // Allow many SSE connections

function channelName(jobId: string): string {
  return `pipeline:${jobId}`;
}

export function emitPipelineEvent(event: PipelineEvent): void {
  emitter.emit(channelName(event.jobId), event);
}

/**
 * Subscribe to pipeline events for a specific job.
 * Returns an unsubscribe function.
 */
export function subscribePipelineEvents(
  jobId: string,
  callback: (event: PipelineEvent) => void,
): () => void {
  const channel = channelName(jobId);
  emitter.on(channel, callback);
  return () => {
    emitter.off(channel, callback);
  };
}
