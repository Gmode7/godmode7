import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { MarkdownViewer } from './MarkdownViewer';
import type { StageStatus } from './PipelineStepper';

interface Artifact {
  type: string;
  content: string;
}

interface Props {
  stage: string;
  label: string;
  status: StageStatus;
  artifacts: Artifact[];
  error?: string;
  onRetry?: () => void;
}

function statusBadge(status: StageStatus) {
  const colors: Record<StageStatus, string> = {
    pending: 'bg-gray-600 text-gray-200',
    running: 'bg-blue-600 text-blue-100 animate-pulse',
    done: 'bg-green-600 text-green-100',
    failed: 'bg-red-600 text-red-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

export function StagePanel({ stage, label, status, artifacts, error, onRetry }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
          }
          <span className="font-semibold text-white">{label}</span>
          {statusBadge(status)}
          {artifacts.length > 0 && (
            <span className="text-xs text-gray-500">
              {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {status === 'failed' && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-white/10 px-5 py-4 space-y-4">
          {status === 'failed' && error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {artifacts.length === 0 && status !== 'failed' && (
            <p className="text-sm text-gray-500 italic">
              {status === 'running' ? 'Generating artifacts...' : 'No artifacts yet'}
            </p>
          )}

          {artifacts.map((artifact, i) => {
            let markdown = artifact.content;
            try {
              const parsed = JSON.parse(artifact.content);
              markdown = parsed.markdown || artifact.content;
            } catch {
              // use raw content
            }
            return (
              <div key={`${artifact.type}-${i}`}>
                <MarkdownViewer
                  content={markdown}
                  filename={`${artifact.type}.md`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
