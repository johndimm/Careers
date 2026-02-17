'use client';

import { useState } from 'react';
import { Search, User, Building2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string, type: 'person' | 'company') => void;
  disabled?: boolean;
}

export default function SearchBar({ onSearch, disabled }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'person' | 'company'>('person');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || disabled) return;
    onSearch(trimmed, searchType);
    setQuery('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex rounded-lg border border-slate-700/50 bg-slate-800/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setSearchType('person')}
          className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
            searchType === 'person'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          Person
        </button>
        <button
          type="button"
          onClick={() => setSearchType('company')}
          className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
            searchType === 'company'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Company
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchType === 'person' ? 'Search a person...' : 'Search a company...'}
          disabled={disabled}
          className="h-9 w-64 rounded-lg border border-slate-700/50 bg-slate-800/50 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 disabled:opacity-50"
        />
      </div>
    </form>
  );
}
