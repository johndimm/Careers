'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Loader2, Check, AlertCircle } from 'lucide-react';
import * as store from '@/lib/store';

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState('deepseek');
  const [available, setAvailable] = useState<string[]>([]);
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  useEffect(() => {
    setActiveProvider(store.getActiveProvider());
    setResumeUrl(store.getResumeUrl());
    setResumeName(store.getResumeName());
    if (store.getResumeName()) setResumeStatus('ok');

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

  const extractResumeName = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setResumeName('');
      setResumeStatus('idle');
      store.setResumeName('');
      return;
    }

    setResumeStatus('loading');
    try {
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.name) {
        setResumeName(data.name);
        store.setResumeName(data.name);
        setResumeStatus('ok');
      } else {
        setResumeName('');
        store.setResumeName('');
        setResumeStatus('error');
      }
    } catch {
      setResumeName('');
      store.setResumeName('');
      setResumeStatus('error');
    }
  }, []);

  const handleResumeUrlChange = (url: string) => {
    setResumeUrl(url);
    store.setResumeUrl(url);
  };

  const handleResumeUrlBlur = () => {
    const trimmed = resumeUrl.trim();
    // Only re-extract if URL changed from what we already extracted
    if (trimmed && trimmed !== store.getResumeUrl()) {
      store.setResumeUrl(trimmed);
    }
    // Extract name if we don't have one yet or URL changed
    if (trimmed && !resumeName) {
      extractResumeName(trimmed);
    }
  };

  const handleResumeUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      extractResumeName(resumeUrl);
    }
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
        Settings
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border border-slate-700/50 bg-slate-900/95 p-2 backdrop-blur-xl shadow-xl">
          <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">LLM Provider</p>
          {available.map(p => (
            <button
              key={p}
              onClick={() => { handleChange(p); }}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                p === activeProvider
                  ? 'bg-slate-700/50 text-slate-200'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              {providerLabels[p] || p}
            </button>
          ))}

          <div className="mt-3 border-t border-slate-700/50 pt-3">
            <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resume URL</p>
            <input
              type="text"
              value={resumeUrl}
              onChange={(e) => handleResumeUrlChange(e.target.value)}
              onBlur={handleResumeUrlBlur}
              onKeyDown={handleResumeUrlKeyDown}
              placeholder="https://example.com/resume.pdf"
              className="mt-1 w-full rounded-md border border-slate-700/50 bg-slate-800/50 px-2 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
            />
            <div className="px-2 mt-1.5 flex items-center gap-1.5">
              {resumeStatus === 'loading' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                  <span className="text-[11px] text-slate-500">Reading resume...</span>
                </>
              )}
              {resumeStatus === 'ok' && resumeName && (
                <>
                  <Check className="h-3 w-3 text-green-400" />
                  <span className="text-[11px] text-green-400">{resumeName}</span>
                </>
              )}
              {resumeStatus === 'error' && (
                <>
                  <AlertCircle className="h-3 w-3 text-red-400" />
                  <span className="text-[11px] text-red-400">Could not read resume</span>
                </>
              )}
              {resumeStatus === 'idle' && (
                <span className="text-[11px] text-slate-600">Enter URL and press Enter</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
