import { useState } from 'react';
import { Key, Server, TestTube, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { getSettings, saveSettings, clearSettings } from '../lib/store';
import { toast } from '../components/ui/Toast';

export function Settings() {
  const settings = getSettings();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  const handleSave = () => {
    saveSettings({ baseUrl, apiKey });
    toast('Settings saved successfully', 'success');
    setTestResult(null);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all settings?')) {
      clearSettings();
      setBaseUrl('http://127.0.0.1:3000');
      setApiKey('');
      toast('Settings cleared', 'info');
      window.location.reload();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      // Test health endpoint
      const healthRes = await fetch(`${baseUrl}/health`);
      if (!healthRes.ok) {
        throw new Error('Server is not responding');
      }
      const healthData = await healthRes.json();
      
      // Test auth endpoint
      const authRes = await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { 'x-api-key': apiKey }
      });
      
      if (authRes.status === 401) {
        setTestResult({
          success: false,
          message: 'API key is invalid or expired'
        });
        toast('API key is invalid', 'error');
      } else if (!authRes.ok) {
        throw new Error('Authentication test failed');
      } else {
        setTestResult({
          success: true,
          message: `Connected! Server v${healthData.version || 'unknown'} is healthy.`
        });
        toast('Connection successful', 'success');
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed'
      });
      toast('Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const hasKey = !!apiKey;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure your API connection and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasKey ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                <Key className={`w-5 h-5 ${hasKey ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-white">API Key</h3>
                <p className="text-sm text-gray-400">
                  {hasKey ? 'Key is configured' : 'No key configured'}
                </p>
              </div>
            </div>
            <Badge variant={hasKey ? 'success' : 'warning'}>
              {hasKey ? 'Active' : 'Missing'}
            </Badge>
          </div>
          
          {hasKey && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="font-mono">{apiKey.slice(0, 20)}...</span>
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-white">API Configuration</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Enter your API key"
            />
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl ${testResult.success ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className={testResult.success ? 'text-emerald-400' : 'text-red-400'}>
                {testResult.message}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={handleTest}
              loading={testing}
              icon={<TestTube className="w-4 h-4" />}
            >
              Test Connection
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
            <Button
              variant="danger"
              onClick={handleClear}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6">
          <h3 className="font-semibold text-violet-300 mb-2">Getting Started</h3>
          <ol className="space-y-2 text-sm text-violet-200/80 list-decimal list-inside">
            <li>Start the backend server: <code className="bg-black/30 px-2 py-0.5 rounded">pnpm dev</code> in the api folder</li>
            <li>Generate an API key: <code className="bg-black/30 px-2 py-0.5 rounded">node scripts/bootstrap.js</code></li>
            <li>Copy the key and paste it above</li>
            <li>Click "Test Connection" to verify</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
