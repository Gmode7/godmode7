import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useToast } from '../hooks/useToast';
import { getSettings, saveSettings, clearSettings } from '../lib/store';

export function Settings() {
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');

  useEffect(() => {
    const settings = getSettings();
    setApiKey(settings.apiKey);
    setBaseUrl(settings.baseUrl);
  }, []);

  const handleSave = () => {
    saveSettings({ apiKey, baseUrl });
    showToast('Settings saved successfully');
  };

  const handleClear = () => {
    clearSettings();
    setApiKey('');
    setBaseUrl('http://127.0.0.1:3000');
    showToast('Local cache cleared');
  };

  return (
    <div className="max-w-3xl space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Configure your GM7 environment and API connections.</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-4">API Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
              <Input 
                type="password" 
                placeholder="Enter your API key" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Your GM7 API key for authentication</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Backend URL</label>
              <Input 
                type="text" 
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">The URL of your GM7 backend API</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave}>Save API Settings</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-4">OpenRouter (Optional)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">OpenRouter API Key</label>
              <Input 
                type="password" 
                placeholder="sk-or-v1-..." 
                value={openRouterKey}
                onChange={e => setOpenRouterKey(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Optional: For accessing free tier AI models. Get key at openrouter.ai</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-4">Preferences</h2>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-white/5">
                <div>
                  <h4 className="font-medium text-white">Dark Mode</h4>
                  <p className="text-xs text-gray-400">GM7 is optimized for dark mode</p>
                </div>
                <div className="w-12 h-6 bg-violet-600 rounded-full relative">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
             </div>
          </div>
        </Card>
        
        <div className="flex justify-end">
           <Button variant="danger" onClick={handleClear}>Clear Local Cache</Button>
        </div>
      </div>
    </div>
  );
}
