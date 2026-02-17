'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Graph, { GraphNode, GraphLink } from '@/components/Graph';
import SearchBar from '@/components/SearchBar';
import SettingsPanel from '@/components/SettingsPanel';
import NodeDetail from '@/components/NodeDetail';
import EdgeDetail from '@/components/EdgeDetail';
import LoadingSpinner from '@/components/LoadingSpinner';
import * as store from '@/lib/store';

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

async function fetchJSON(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const text = await res.text();
  if (!res.ok) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function Home() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Researching...');
  const loadingNodesRef = useRef<Set<string>>(new Set());

  const rebuildGraph = useCallback(() => {
    const data = store.buildGraph();
    // Stamp isLoading onto nodes that are currently being fetched
    const loading = loadingNodesRef.current;
    if (loading.size > 0) {
      data.nodes = data.nodes.map(n => loading.has(n.id) ? { ...n, isLoading: true } : n);
    }
    setGraphData(data);
  }, []);

  // Load existing graph from localStorage on mount
  useEffect(() => {
    rebuildGraph();
  }, [rebuildGraph]);

  const handleSearch = useCallback(async (query: string, type: 'person' | 'company') => {
    setLoading(true);
    setLoadingMessage(type === 'person' ? `Researching ${query}...` : `Looking up ${query}...`);

    try {
      const endpoint = type === 'person' ? '/api/person' : '/api/company';
      const data = await fetchJSON(endpoint, { name: query, provider: store.getActiveProvider() });

      if (data && type === 'person' && data.person) {
        store.mergePersonData(data.person as Parameters<typeof store.mergePersonData>[0]);
      } else if (data && type === 'company' && data.company) {
        store.mergeCompanyData(data.company as Parameters<typeof store.mergeCompanyData>[0]);
      }

      rebuildGraph();
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, [rebuildGraph]);

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    // Clear link selection when clicking a node
    setSelectedLink(null);

    // If the node has no id (background click), deselect
    if (!node.id) {
      setSelectedNode(null);
      return;
    }

    const norm = store.normFromNodeId(node.id);

    if (node.type === 'company') {
      // Fetch people for this company — each click may bring new people
      const excludeNames = store.getCompanyPeopleNames(norm);
      loadingNodesRef.current.add(node.id);
      rebuildGraph();
      fetchJSON('/api/company', { name: node.name, provider: store.getActiveProvider(), excludeNames })
        .then(data => {
          if (data?.company) store.mergeCompanyData(data.company as Parameters<typeof store.mergeCompanyData>[0]);
        })
        .catch(e => console.error('Company expand error:', e))
        .finally(() => {
          loadingNodesRef.current.delete(node.id);
          rebuildGraph();
        });
    } else if (node.type === 'person') {
      // Fetch companies for this person — each click may find more
      const excludeCompanies = store.getPersonCompanyNames(norm);
      loadingNodesRef.current.add(node.id);
      rebuildGraph();
      fetchJSON('/api/person', { name: node.name, provider: store.getActiveProvider(), excludeCompanies })
        .then(data => {
          if (data?.person) store.mergePersonData(data.person as Parameters<typeof store.mergePersonData>[0]);
        })
        .catch(e => console.error('Person expand error:', e))
        .finally(() => {
          loadingNodesRef.current.delete(node.id);
          rebuildGraph();
        });
    }

    // Toggle node selection immediately
    setSelectedNode(prev => {
      const currentGraph = store.buildGraph();
      const freshNode = currentGraph.nodes.find(n => n.id === node.id);
      if (prev?.id === node.id) return null;
      return freshNode || node;
    });
  }, [rebuildGraph]);

  const handleLinkClick = useCallback((link: GraphLink) => {
    setSelectedNode(null);
    setSelectedLink(prev => {
      const prevSource = prev ? (typeof prev.source === 'string' ? prev.source : prev.source.id) : null;
      const prevTarget = prev ? (typeof prev.target === 'string' ? prev.target : prev.target.id) : null;
      const newSource = typeof link.source === 'string' ? link.source : link.source.id;
      const newTarget = typeof link.target === 'string' ? link.target : link.target.id;
      return (prevSource === newSource && prevTarget === newTarget) ? null : link;
    });
  }, []);

  const handleDetailNodeClick = useCallback((nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node) {
      handleNodeClick(node);
    }
  }, [graphData.nodes, handleNodeClick]);

  const handleClear = useCallback(() => {
    store.clearGraph();
    setGraphData({ nodes: [], links: [] });
    setSelectedNode(null);
    setSelectedLink(null);
  }, []);

  // Build edge info for selected node
  const selectedEdges = selectedNode
    ? graphData.links
        .filter(l => {
          const sid = typeof l.source === 'string' ? l.source : l.source.id;
          const tid = typeof l.target === 'string' ? l.target : l.target.id;
          return sid === selectedNode.id || tid === selectedNode.id;
        })
        .map(l => {
          const sid = typeof l.source === 'string' ? l.source : l.source.id;
          const tid = typeof l.target === 'string' ? l.target : l.target.id;
          const connectedId = sid === selectedNode.id ? tid : sid;
          const connectedNode = graphData.nodes.find(n => n.id === connectedId);
          return {
            position: l.position,
            startYear: l.startYear,
            endYear: l.endYear,
            projects: l.projects,
            coworkers: l.coworkers,
            reportsTo: l.reportsTo,
            performanceComments: l.performanceComments,
            connectedNode: connectedNode || { id: connectedId, name: 'Unknown', type: 'person' as const },
          };
        })
    : [];

  // Resolve link node names for EdgeDetail
  const linkSourceNode = selectedLink
    ? graphData.nodes.find(n => n.id === (typeof selectedLink.source === 'string' ? selectedLink.source : selectedLink.source.id))
    : null;
  const linkTargetNode = selectedLink
    ? graphData.nodes.find(n => n.id === (typeof selectedLink.target === 'string' ? selectedLink.target : selectedLink.target.id))
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm z-30">
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">
          Careers Graph
        </h1>
        <div className="flex items-center gap-3">
          <SearchBar onSearch={handleSearch} disabled={loading} />
          {graphData.nodes.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 transition-colors hover:text-red-400 hover:border-red-700/50"
            >
              Clear
            </button>
          )}
          <SettingsPanel />
        </div>
      </header>

      {/* Graph canvas */}
      <main className="flex-1 relative">
        <Graph
          nodes={graphData.nodes}
          links={graphData.links}
          selectedNodeId={selectedNode?.id || null}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
        />

        {graphData.nodes.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-slate-500 text-lg font-light">Search for a person or company to begin</p>
              <p className="text-slate-600 text-sm mt-1">Try &quot;John Dimm&quot; or &quot;Websense&quot;</p>
            </div>
          </div>
        )}
      </main>

      {/* Node detail sidebar */}
      {selectedNode && (
        <NodeDetail
          node={selectedNode}
          edges={selectedEdges}
          onClose={() => setSelectedNode(null)}
          onNodeClick={handleDetailNodeClick}
        />
      )}

      {/* Edge detail panel */}
      {selectedLink && linkSourceNode && linkTargetNode && (
        <EdgeDetail
          link={selectedLink}
          sourceNode={linkSourceNode}
          targetNode={linkTargetNode}
          onClose={() => setSelectedLink(null)}
          onNodeClick={handleDetailNodeClick}
        />
      )}

      {/* Loading overlay */}
      {loading && <LoadingSpinner message={loadingMessage} />}
    </div>
  );
}
