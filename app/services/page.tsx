'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Play, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ServiceDef {
  id: string;
  name: string;
  description: string;
  usedFor: 'person' | 'company' | 'both';
  phase: string;
  examples: { label: string; query: string }[];
}

const SERVICES: ServiceDef[] = [
  {
    id: 'ddg-search',
    name: 'DuckDuckGo HTML Search',
    description: 'Scrapes DuckDuckGo HTML search results to find career-related snippets and URLs. Free, no API key required. Indexes LinkedIn data via third-party sites like ContactOut, RocketReach, and ZoomInfo.',
    usedFor: 'both',
    phase: 'Web Search',
    examples: [
      { label: 'Person career search', query: 'John Dimm career work history employment resume' },
      { label: 'Company leadership', query: 'Websense company executives founders leadership team' },
      { label: 'Company employees on LinkedIn', query: '"Websense" employees engineers directors managers site:linkedin.com' },
    ],
  },
  {
    id: 'ddg-instant-answer',
    name: 'DuckDuckGo Instant Answer API',
    description: 'Queries the DuckDuckGo Instant Answer API for entity information and images. Returns structured data including abstracts, images, and related topics. Used for finding person photos and company logos.',
    usedFor: 'both',
    phase: 'Image Lookup',
    examples: [
      { label: 'Person photo', query: 'Elon Musk' },
      { label: 'Company logo', query: 'Google' },
      { label: 'Smaller company', query: 'Websense' },
    ],
  },
  {
    id: 'exa-neural',
    name: 'Exa Neural Search',
    description: 'Uses Exa\'s neural (semantic) search to find relevant pages about a person\'s career or a company\'s team. Returns page content snippets. Requires EXA_API_KEY.',
    usedFor: 'both',
    phase: 'Web Search',
    examples: [
      { label: 'Person career', query: 'John Dimm professional experience resume career history' },
      { label: 'Company team', query: 'who works at Websense team members staff' },
    ],
  },
  {
    id: 'exa-keyword',
    name: 'Exa Keyword Search',
    description: 'Uses Exa\'s keyword-based search for exact-match queries. Good for finding specific mentions of a person or company. Returns page content snippets.',
    usedFor: 'both',
    phase: 'Web Search',
    examples: [
      { label: 'Person work experience', query: '"John Dimm" work experience companies' },
      { label: 'Company employees', query: '"Websense" employees engineers product design marketing' },
    ],
  },
  {
    id: 'exa-linkedin',
    name: 'Exa LinkedIn Content Fetch',
    description: 'Searches for a person\'s LinkedIn profile URL via Exa keyword search, then uses Exa\'s getContents to fetch the LinkedIn page text. Exa can index LinkedIn, which is otherwise difficult to scrape.',
    usedFor: 'person',
    phase: 'Web Search',
    examples: [
      { label: 'Find LinkedIn profile', query: 'Satya Nadella' },
      { label: 'Less notable person', query: 'John Dimm' },
    ],
  },
  {
    id: 'wikipedia-image',
    name: 'Wikipedia Page Image',
    description: 'Searches Wikipedia for an article matching the query, then fetches the page image thumbnail. Works well for notable people and companies, especially defunct ones.',
    usedFor: 'both',
    phase: 'Image Lookup',
    examples: [
      { label: 'Notable person', query: 'Elon Musk' },
      { label: 'Company', query: 'Websense' },
      { label: 'Defunct company', query: 'Netscape' },
    ],
  },
  {
    id: 'google-favicon',
    name: 'Google Favicon V2',
    description: 'Fetches a high-resolution (128px) favicon/logo for a company domain via Google\'s Favicon V2 service. The domain is guessed from the company name or looked up from a known list.',
    usedFor: 'company',
    phase: 'Image Lookup',
    examples: [
      { label: 'Major company', query: 'google.com' },
      { label: 'Tech company', query: 'microsoft.com' },
      { label: 'Smaller domain', query: 'websense.com' },
    ],
  },
];

const LLM_PROVIDERS = [
  { name: 'Anthropic Claude Sonnet 4', model: 'claude-sonnet-4-20250514', sdk: '@anthropic-ai/sdk' },
  { name: 'OpenAI GPT-4o', model: 'gpt-4o', sdk: 'openai' },
  { name: 'DeepSeek Chat', model: 'deepseek-chat', sdk: 'openai (custom baseURL)' },
  { name: 'Google Gemini 1.5 Flash', model: 'gemini-1.5-flash', sdk: '@google/generative-ai' },
];

interface ServiceResult {
  loading: boolean;
  data: unknown | null;
  error: string | null;
}

function ServiceCard({ service }: { service: ServiceDef }) {
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<Record<string, ServiceResult>>({});

  const runExample = async (query: string) => {
    const key = `${service.id}:${query}`;
    setResults(prev => ({ ...prev, [key]: { loading: true, data: null, error: null } }));
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: service.id, query }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResults(prev => ({ ...prev, [key]: { loading: false, data: null, error: json.error || 'Failed' } }));
      } else {
        setResults(prev => ({ ...prev, [key]: { loading: false, data: json.result, error: null } }));
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [key]: { loading: false, data: null, error: String(e) } }));
    }
  };

  const phaseColor = service.phase === 'Web Search'
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-purple-500/20 text-purple-400';

  const usedForColor = service.usedFor === 'person'
    ? 'bg-amber-500/20 text-amber-400'
    : service.usedFor === 'company'
    ? 'bg-cyan-500/20 text-cyan-400'
    : 'bg-green-500/20 text-green-400';

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-100">{service.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${phaseColor}`}>{service.phase}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${usedForColor}`}>
              {service.usedFor === 'both' ? 'Person + Company' : service.usedFor === 'person' ? 'Person' : 'Company'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{service.description}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/30 p-4 space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Try it</h4>
          {service.examples.map((ex) => {
            const key = `${service.id}:${ex.query}`;
            const result = results[key];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runExample(ex.query)}
                    disabled={result?.loading}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
                  >
                    {result?.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {ex.label}
                  </button>
                  <code className="text-[10px] text-slate-500 truncate">{ex.query}</code>
                </div>
                {result && result.data !== null && (
                  <pre className="rounded-lg bg-slate-950 border border-slate-700/30 p-3 text-xs text-slate-300 overflow-x-auto max-h-80 overflow-y-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
                {result?.error && (
                  <div className="rounded-lg bg-red-950/30 border border-red-700/30 p-3 text-xs text-red-400">
                    {result.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ServicesPage() {
  const personServices = SERVICES.filter(s => s.usedFor === 'person' || s.usedFor === 'both');
  const companyServices = SERVICES.filter(s => s.usedFor === 'company' || s.usedFor === 'both');

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Graph
          </Link>
          <div className="h-4 w-px bg-slate-700/50" />
          <h1 className="text-lg font-semibold tracking-tight">Services Documentation</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Overview */}
        <section>
          <p className="text-sm text-slate-400 leading-relaxed">
            Careers Graph queries multiple external services to research a person or company.
            Each service is called during a specific phase of the pipeline. Click any service below to expand it and run example queries to see the raw output.
          </p>
        </section>

        {/* Pipeline diagram */}
        <section>
          <h2 className="text-base font-semibold text-slate-200 mb-4">Pipeline</h2>
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-300">
              1. Web Search
              <div className="text-[10px] text-blue-400/60 mt-0.5">DDG, Exa, LinkedIn</div>
            </div>
            <span className="text-slate-600">→</span>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">
              2. LLM Extraction
              <div className="text-[10px] text-amber-400/60 mt-0.5">Claude / GPT-4o / etc.</div>
            </div>
            <span className="text-slate-600">→</span>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-purple-300">
              3. Image Lookup
              <div className="text-[10px] text-purple-400/60 mt-0.5">Wikipedia, DDG, Google</div>
            </div>
            <span className="text-slate-600">→</span>
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-300">
              4. Graph
              <div className="text-[10px] text-green-400/60 mt-0.5">D3 force layout</div>
            </div>
          </div>
        </section>

        {/* Person lookup */}
        <section>
          <h2 className="text-base font-semibold text-slate-200 mb-2">Person Lookup</h2>
          <p className="text-xs text-slate-500 mb-4">
            When you search for a person, these services run in parallel to gather career data.
            The combined text is sent to an LLM which extracts structured JSON (name, summary, companies, positions, dates).
            Then image services find a photo.
          </p>
          <div className="space-y-3">
            {personServices.map(s => <ServiceCard key={s.id} service={s} />)}
          </div>
        </section>

        {/* Company lookup */}
        <section>
          <h2 className="text-base font-semibold text-slate-200 mb-2">Company Lookup</h2>
          <p className="text-xs text-slate-500 mb-4">
            When you search for a company, similar services run to find notable employees.
            The LLM extracts company info (description, products, history) plus a list of notable people.
            Image services find a logo.
          </p>
          <div className="space-y-3">
            {companyServices.map(s => <ServiceCard key={s.id} service={s} />)}
          </div>
        </section>

        {/* LLM Providers */}
        <section>
          <h2 className="text-base font-semibold text-slate-200 mb-2">LLM Providers</h2>
          <p className="text-xs text-slate-500 mb-4">
            The search results are sent to one of these LLM providers (selectable in Settings) to extract structured career data.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LLM_PROVIDERS.map(p => (
              <div key={p.model} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{p.name}</h3>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">{p.model}</p>
                <p className="text-[10px] text-slate-500">SDK: {p.sdk}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
