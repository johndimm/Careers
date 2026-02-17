'use client';

import { useRef, useEffect } from 'react';
import { Loader2, Check, Search, Brain, ImageIcon } from 'lucide-react';
import type { ProgressStep } from '@/app/page';

interface LoadingSpinnerProps {
  title?: string;
  steps?: ProgressStep[];
}

const phaseIcons: Record<string, React.ReactNode> = {
  search: <Search className="h-3.5 w-3.5" />,
  llm: <Brain className="h-3.5 w-3.5" />,
  images: <ImageIcon className="h-3.5 w-3.5" />,
};

export default function LoadingSpinner({ title = 'Researching...', steps = [] }: LoadingSpinnerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/95 px-8 py-6 backdrop-blur-xl border border-slate-700/50 min-w-[420px] max-w-[520px]">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-slate-200">{title}</p>
        </div>

        {steps.length > 0 && (
          <div ref={scrollRef} className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="shrink-0 w-4 h-4 flex items-center justify-center mt-0.5">
                  {step.done ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500/70" />
                  )}
                </div>
                <div className={`shrink-0 mt-0.5 ${step.done ? 'text-slate-500' : 'text-slate-400'}`}>
                  {phaseIcons[step.phase] || null}
                </div>
                <span className={`text-xs leading-relaxed ${step.done ? 'text-slate-500' : 'text-slate-300'}`}>
                  {step.step}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
