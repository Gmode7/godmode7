import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ToastContainer } from './components/ui/Toast';
import { getSettings } from './lib/store';
import { onApiError, ApiClientError } from './lib/api';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { JobDetail } from './pages/JobDetail';
import { Agents } from './pages/Agents';
import { Settings } from './pages/Settings';
import { Chat } from './pages/Chat';
import { Pipeline } from './pages/Pipeline';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<{type: 'auth' | 'provider', provider?: string} | undefined>();
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setHasKey(!!settings.apiKey);
    
    if (!settings.apiKey) {
      setApiKeyModalOpen(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onApiError((error: ApiClientError) => {
      if (error.status === 401) {
        setApiKeyError({ type: 'auth' });
        setApiKeyModalOpen(true);
      } else if (error.status === 503 && error.data?.missing) {
        const missing = error.data.missing;
        let provider = 'Provider';
        if (missing.includes('OPENAI_API_KEY')) provider = 'OpenAI';
        else if (missing.includes('KIMI_API_KEY')) provider = 'Kimi';
        else if (missing.includes('ANTHROPIC_API_KEY')) provider = 'Claude';
        
        setApiKeyError({ type: 'provider', provider });
        setApiKeyModalOpen(true);
      }
    });

    return unsubscribe;
  }, []);

  const handleModalClose = () => {
    const settings = getSettings();
    if (settings.apiKey) {
      setHasKey(true);
      setApiKeyModalOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/pipeline/:jobId" element={<Pipeline />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={handleModalClose}
        errorType={apiKeyError?.type}
        providerName={apiKeyError?.provider}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
