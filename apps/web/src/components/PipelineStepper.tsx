const STAGES = [
  { key: 'INTAKE', label: 'Intake' },
  { key: 'PM', label: 'PM' },
  { key: 'ARCH', label: 'Arch' },
  { key: 'ENG', label: 'Eng' },
  { key: 'QA', label: 'QA' },
  { key: 'SEC', label: 'Sec' },
  { key: 'DOCS', label: 'Docs' },
];

export type StageStatus = 'pending' | 'running' | 'done' | 'failed';

interface Props {
  stages: Record<string, StageStatus>;
  currentStage: string;
}

function getStatusColor(status: StageStatus): string {
  switch (status) {
    case 'done': return 'bg-green-500 border-green-400';
    case 'running': return 'bg-blue-500 border-blue-400 animate-pulse';
    case 'failed': return 'bg-red-500 border-red-400';
    default: return 'bg-gray-600 border-gray-500';
  }
}

function getLineColor(status: StageStatus): string {
  switch (status) {
    case 'done': return 'bg-green-500';
    case 'running': return 'bg-blue-500';
    case 'failed': return 'bg-red-500';
    default: return 'bg-gray-700';
  }
}

export function PipelineStepper({ stages, currentStage }: Props) {
  return (
    <div className="flex items-center justify-between w-full px-4 py-6">
      {STAGES.map((stage, i) => {
        const status = stages[stage.key] || 'pending';
        const isCurrent = stage.key === currentStage;

        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            {/* Node */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full border-2 flex items-center justify-center
                  ${getStatusColor(status)}
                  ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}
                `}
              >
                {status === 'done' && (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === 'running' && (
                  <div className="w-3 h-3 bg-white rounded-full" />
                )}
                {status === 'failed' && (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {status === 'pending' && (
                  <span className="text-xs text-gray-300 font-bold">{i + 1}</span>
                )}
              </div>
              <span className={`text-xs mt-2 font-medium ${isCurrent ? 'text-blue-300' : status === 'done' ? 'text-green-300' : 'text-gray-400'}`}>
                {stage.label}
              </span>
            </div>

            {/* Connecting line */}
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${getLineColor(status === 'done' ? 'done' : 'pending')}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
