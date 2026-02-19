import { useState } from 'react';
import { Key, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { getSettings, saveSettings } from '../lib/store';
import { api } from '../lib/api';
import { toast } from './ui/Toast';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorType?: 'auth' | 'provider';
  providerName?: string;
}

export function ApiKeyModal({ isOpen, onClose, errorType, providerName }: ApiKeyModalProps) {
  const settings = getSettings();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    saveSettings({ apiKey, baseUrl });
    toast('Settings saved', 'success');
    onClose();
    window.location.reload();
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Test health endpoint (no auth)
      const healthRes = await fetch(`${baseUrl}/health`);
      if (!healthRes.ok) throw new Error('Server not reachable');
      
      // Test auth endpoint
      const authRes = await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { 'x-api-key': apiKey }
      });
      
      if (authRes.status === 401) {
        toast('API key is invalid', 'error');
      } else if (!authRes.ok) {
        throw new Error('Connection failed');
      } else {
        toast('Connection successful!', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Connection failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="API Configuration" size="md">
      <div className="space-y-6">
        {errorType === 'auth' && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-400">Authentication Required</h4>
              <p className="text-sm text-red-300/80 mt-1">
                Your API key is missing or invalid. Please enter a valid key to continue.
              </p>
            </div>
          </div>
        )}
        
        {errorType === 'provider' && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-400">Provider Not Configured</h4>
              <p className="text-sm text-amber-300/80 mt-1">
                {providerName ? `${providerName} is not configured yet. ` : ''}
                This feature will be available once the provider API key is set on the server.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            API Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="http://127.0.0.1:3000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="ainb_... or gm7_..."
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Run <code className="bg-white/10 px-1.5 py-0.5 rounded">pnpm bootstrap</code> in the backend to generate a key
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={handleTest}
            loading={testing}
            className="flex-1"
          >
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1"
          >
            Save & Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
