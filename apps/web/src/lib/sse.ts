import { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings } from './store';

export interface PipelineEvent {
  jobId: string;
  type: string;
  stage?: string;
  data?: any;
  timestamp: string;
}

export function usePipelineEvents(jobId: string | null) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(async () => {
    if (!jobId) return;

    // Abort any existing connection
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const settings = getSettings();
    const url = `${settings.baseUrl}/api/v1/pipeline/${jobId}/events`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': settings.apiKey || '',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        setError(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: PipelineEvent = JSON.parse(line.slice(6));
              setEvents(prev => [...prev, event]);

              if (event.stage) {
                setCurrentStage(event.stage);
              }

              if (event.type === 'initial_state' && event.data?.currentState) {
                const state = event.data.currentState as string;
                if (state === 'COMPLETED') {
                  setIsComplete(true);
                } else {
                  const stagePrefix = state.split('_')[0];
                  setCurrentStage(stagePrefix);
                }
              }

              if (event.type === 'pipeline_completed') {
                setIsComplete(true);
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Connection failed');
      }
    }
  }, [jobId]);

  useEffect(() => {
    setEvents([]);
    setCurrentStage('');
    setIsComplete(false);
    setError(null);
    connect();

    return () => {
      abortRef.current?.abort();
    };
  }, [connect]);

  return { events, currentStage, isComplete, error };
}
