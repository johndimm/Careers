'use client';

import { useState } from 'react';
import { X, User, Building2, Briefcase, Calendar, Users, ArrowUp, FileText, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { GraphLink, GraphNode } from './Graph';

interface EdgeDetailProps {
  link: GraphLink;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  onClose: () => void;
  onNodeClick: (id: string) => void;
}

export default function EdgeDetail({ link, sourceNode, targetNode, onClose, onNodeClick }: EdgeDetailProps) {
  const [minimized, setMinimized] = useState(false);
  const person = sourceNode.type === 'person' ? sourceNode : targetNode;
  const company = sourceNode.type === 'company' ? sourceNode : targetNode;

  if (minimized) {
    return (
      <div className="fixed right-0 top-0 h-full w-10 z-40 border-l border-slate-700/50 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center pt-3 gap-2">
        <button
          onClick={() => setMinimized(false)}
          className="rounded-md p-1 text-slate-400 hover:text-slate-200 transition-colors"
          title="Expand sidebar"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:text-slate-300 transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mt-2 flex-1 flex items-start justify-center">
          <span
            className="text-xs text-slate-500 whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {person.name} — {company.name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 z-40 overflow-y-auto border-l border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Connection</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(true)}
              className="rounded-md p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Minimize sidebar"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Person */}
        <button
          onClick={() => onNodeClick(person.id)}
          className="flex items-center gap-2 mb-3 hover:text-amber-400 transition-colors"
        >
          <User className="h-5 w-5 text-amber-500" />
          <span className="text-lg font-semibold text-slate-100">{person.name}</span>
        </button>

        {/* Arrow down */}
        <div className="flex items-center gap-2 ml-2 mb-3">
          <div className="w-0.5 h-4 bg-slate-600" />
        </div>

        {/* Position info */}
        {link.position && (
          <div className="rounded-lg border border-slate-700/30 bg-slate-800/40 p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-slate-200">{link.position}</span>
            </div>

            {(link.startYear || link.endYear) && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Calendar className="h-3.5 w-3.5" />
                {link.startYear || '?'} – {link.endYear || 'present'}
              </div>
            )}

            {link.projects && link.projects.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="h-3 w-3 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Projects</span>
                </div>
                <ul className="space-y-0.5">
                  {link.projects.map((p, i) => (
                    <li key={i} className="text-xs text-slate-400 pl-4">• {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {link.coworkers && link.coworkers.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1 mb-1">
                  <Users className="h-3 w-3 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Coworkers</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {link.coworkers.map((c, i) => (
                    <span key={i} className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {link.reportsTo && (
              <div className="mt-3">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUp className="h-3 w-3 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Reports to</span>
                </div>
                <span className="text-xs text-slate-400">{link.reportsTo}</span>
              </div>
            )}

            {link.performanceComments && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Notes</span>
                <p className="text-xs text-slate-400 leading-relaxed">{link.performanceComments}</p>
              </div>
            )}
          </div>
        )}

        {/* Arrow down */}
        <div className="flex items-center gap-2 ml-2 mb-3">
          <div className="w-0.5 h-4 bg-slate-600" />
        </div>

        {/* Company */}
        <button
          onClick={() => onNodeClick(company.id)}
          className="flex items-center gap-2 hover:text-blue-400 transition-colors"
        >
          <Building2 className="h-5 w-5 text-blue-500" />
          <span className="text-lg font-semibold text-slate-100">{company.name}</span>
        </button>
      </div>
    </div>
  );
}
