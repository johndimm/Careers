'use client';

import { useState, useEffect, useRef } from 'react';
import { X, User, Building2, Briefcase, Calendar, Link2, Check, RefreshCw, Merge } from 'lucide-react';

interface EdgeInfo {
  position?: string;
  startYear?: number | null;
  endYear?: number | null;
  projects?: string[];
  coworkers?: string[];
  reportsTo?: string | null;
  performanceComments?: string | null;
  connectedNode: { id: string; name: string; type: 'person' | 'company' };
}

interface NodeDetailProps {
  node: {
    id: string;
    type: 'person' | 'company';
    name: string;
    summary?: string;
    description?: string;
    products?: string;
    history?: string;
    imageUrl?: string;
  } | null;
  edges: EdgeInfo[];
  onClose: () => void;
  onNodeClick: (id: string) => void;
  onRetryPhoto?: (nodeId: string, currentImageUrl: string | null) => Promise<void>;
  onMerge?: (sourceId: string, targetId: string) => void;
  companyNodes?: { id: string; name: string }[];
}

export default function NodeDetail({ node, edges, onClose, onNodeClick, onRetryPhoto, onMerge, companyNodes }: NodeDetailProps) {
  const [copied, setCopied] = useState(false);
  const [retryingPhoto, setRetryingPhoto] = useState(false);
  const [showMergeList, setShowMergeList] = useState(false);
  const prevNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (node?.id !== prevNodeIdRef.current) {
      setRetryingPhoto(false);
      setShowMergeList(false);
      prevNodeIdRef.current = node?.id ?? null;
    }
  }, [node?.id]);

  if (!node) return null;

  const isPerson = node.type === 'person';

  const handleRetryPhoto = async () => {
    if (!onRetryPhoto || retryingPhoto) return;
    setRetryingPhoto(true);
    try {
      await onRetryPhoto(node.id, node.imageUrl || null);
    } finally {
      setRetryingPhoto(false);
    }
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.href.split('?')[0]);
    url.searchParams.set(isPerson ? 'person' : 'company', node.name);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 z-40 overflow-y-auto border-l border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {node.imageUrl ? (
              <img
                src={node.imageUrl}
                alt={node.name}
                className={`w-10 h-10 object-cover ${isPerson ? 'rounded-full' : 'rounded-lg'}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : isPerson ? (
              <User className="h-5 w-5 text-amber-500" />
            ) : (
              <Building2 className="h-5 w-5 text-blue-500" />
            )}
            <h2 className="text-lg font-semibold text-slate-100">{node.name}</h2>
          </div>
          <div className="flex items-center gap-1">
            {isPerson && onRetryPhoto && (
              <button
                onClick={handleRetryPhoto}
                disabled={retryingPhoto}
                className="rounded-md p-1 text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                title="Try different photo"
              >
                <RefreshCw className={`h-4 w-4 ${retryingPhoto ? 'animate-spin' : ''}`} />
              </button>
            )}
            {!isPerson && onMerge && companyNodes && companyNodes.length > 0 && (
              <button
                onClick={() => setShowMergeList(prev => !prev)}
                className="rounded-md p-1 text-slate-500 hover:text-blue-400 transition-colors"
                title="Merge with another company"
              >
                <Merge className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className="rounded-md p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Copy shareable link"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Link2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showMergeList && onMerge && companyNodes && (
          <div className="mb-4 rounded-lg border border-slate-700/30 bg-slate-800/30 p-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-slate-500 mb-2">Merge into this company:</p>
            {companyNodes.map(cn => (
              <button
                key={cn.id}
                onClick={() => { onMerge(cn.id, node.id); setShowMergeList(false); }}
                className="block w-full text-left text-sm text-slate-300 hover:text-amber-400 hover:bg-slate-700/30 rounded px-2 py-1 transition-colors"
              >
                {cn.name}
              </button>
            ))}
          </div>
        )}

        {isPerson && node.summary && (
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">{node.summary}</p>
        )}

        {!isPerson && (
          <div className="space-y-3 mb-6">
            {node.description && (
              <p className="text-sm text-slate-400 leading-relaxed">{node.description}</p>
            )}
            {node.products && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Products</h3>
                <p className="text-sm text-slate-400">{node.products}</p>
              </div>
            )}
            {node.history && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">History</h3>
                <p className="text-sm text-slate-400">{node.history}</p>
              </div>
            )}
          </div>
        )}

        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {isPerson ? 'Companies' : 'People'}
        </h3>

        <div className="space-y-3">
          {edges.map((edge, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-3"
            >
              <button
                onClick={() => onNodeClick(edge.connectedNode.id)}
                className="text-sm font-medium text-slate-200 hover:text-amber-400 transition-colors flex items-center gap-1.5"
              >
                {edge.connectedNode.type === 'person' ? (
                  <User className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                )}
                {edge.connectedNode.name}
              </button>

              {edge.position && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                  <Briefcase className="h-3 w-3" />
                  {edge.position}
                </div>
              )}

              {(edge.startYear || edge.endYear) && (
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                  <Calendar className="h-3 w-3" />
                  {edge.startYear || '?'} – {edge.endYear || 'present'}
                </div>
              )}

              {edge.projects && edge.projects.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-slate-500">Projects: </span>
                  <span className="text-xs text-slate-400">{edge.projects.join(', ')}</span>
                </div>
              )}

              {edge.coworkers && edge.coworkers.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-slate-500">Coworkers: </span>
                  <span className="text-xs text-slate-400">{edge.coworkers.join(', ')}</span>
                </div>
              )}

              {edge.reportsTo && (
                <div className="mt-1">
                  <span className="text-xs text-slate-500">Reports to: </span>
                  <span className="text-xs text-slate-400">{edge.reportsTo}</span>
                </div>
              )}

              {edge.performanceComments && (
                <div className="mt-1">
                  <span className="text-xs text-slate-500">Notes: </span>
                  <span className="text-xs text-slate-400">{edge.performanceComments}</span>
                </div>
              )}
            </div>
          ))}

          {edges.length === 0 && (
            <p className="text-sm text-slate-500 italic">No connections yet. Click to expand.</p>
          )}
        </div>
      </div>
    </div>
  );
}
