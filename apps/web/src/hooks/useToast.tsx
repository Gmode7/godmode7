import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Toast } from '../types';

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(toast => toast.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'info': return 'ℹ';
    }
  };

  const getStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'error': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'info': return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className="animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto"
        >
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 text-sm font-medium ${getStyles(toast.type)}`}>
            <span>{getIcon(toast.type)}</span>
            {toast.message}
          </div>
        </div>
      ))}
    </div>
  );
}
