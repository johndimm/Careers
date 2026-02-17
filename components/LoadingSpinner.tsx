'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = 'Researching...' }: LoadingSpinnerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-900/95 px-8 py-6 backdrop-blur-xl border border-slate-700/50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-light text-slate-300">{message}</p>
      </div>
    </div>
  );
}
