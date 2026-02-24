import type { JobState } from '../types';

export const cx = (...classes: (string | undefined | null | false)[]) => 
  classes.filter(Boolean).join(' ');

export const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).format(new Date(dateString));
};

export const formatDateShort = (dateString: string) => {
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric'
  }).format(new Date(dateString));
};

export const getStatusColor = (state: JobState | string) => {
  switch (state) {
    case 'DONE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'FAILED': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    case 'INTAKE':
    case 'PM':
    case 'ARCH':
    case 'ENG':
    case 'QA':
    case 'SEC':
    case 'DOCS':
      return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

export const PIPELINE_STAGES: JobState[] = ['INTAKE', 'PM', 'ARCH', 'ENG', 'QA', 'SEC', 'DOCS', 'DONE'];
