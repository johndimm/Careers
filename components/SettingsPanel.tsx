'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import * as store from '@/lib/store';

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState('anthropic');
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    // Read current selection from localStorage
    setActiveProvider(store.getActiveProvider());

    // Fetch available providers from server
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setAvailable(data.available || []);
      })
      .catch(() => {});
  }, []);

  const handleChange = (provider: string) => {
    store.setActiveProvider(provider);
    setActiveProvider(provider);
  };

  const providerLabels: Record<string, string> = {
    anthropic: 'Anthropic (Claude)',
    openai: 'OpenAI (GPT-4o)',
    deepseek: 'DeepSeek',
    gemini: 'Google (Gemini)',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 transition-colors hover:text-slate-300"
      >
        <Settings className="h-3.5 w-3.5" />
        {providerLabels[activeProvider] || activeProvider}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-slate-700/50 bg-slate-900/95 p-2 backdrop-blur-xl shadow-xl">
          <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">LLM Provider</p>
          {available.map(p => (
            <button
              key={p}
              onClick={() => { handleChange(p); setIsOpen(false); }}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                p === activeProvider
                  ? 'bg-slate-700/50 text-slate-200'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              {providerLabels[p] || p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
