'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

export interface GraphNode {
  id: string;
  type: 'person' | 'company';
  name: string;
  expanded: boolean;
  isLoading?: boolean;
  summary?: string;
  description?: string;
  products?: string;
  history?: string;
  imageUrl?: string;
  // d3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  position?: string;
  startYear?: number | null;
  endYear?: number | null;
  projects?: string[];
  coworkers?: string[];
  reportsTo?: string | null;
  performanceComments?: string | null;
}

interface GraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  onLinkClick?: (link: GraphLink) => void;
}

const NODE_RADIUS = 24;
const COMPANY_W = 48;
const COMPANY_H = 48;

export default function Graph({ nodes, links, selectedNodeId, onNodeClick, onLinkClick }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  const getNeighborIds = useCallback((nodeId: string): Set<string> => {
    const ids = new Set<string>();
    ids.add(nodeId);
    links.forEach(l => {
      const sid = typeof l.source === 'string' ? l.source : l.source.id;
      const tid = typeof l.target === 'string' ? l.target : l.target.id;
      if (sid === nodeId) ids.add(tid);
      if (tid === nodeId) ids.add(sid);
    });
    return ids;
  }, [links]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    // Define clip paths for circular images
    const defs = svg.append('defs');

    // Circular clip for person photos
    defs.append('clipPath')
      .attr('id', 'clip-circle')
      .append('circle')
      .attr('r', NODE_RADIUS)
      .attr('cx', 0)
      .attr('cy', 0);

    // Rounded rect clip for company logos
    defs.append('clipPath')
      .attr('id', 'clip-rect')
      .append('rect')
      .attr('width', COMPANY_W)
      .attr('height', COMPANY_H)
      .attr('x', -COMPANY_W / 2)
      .attr('y', -COMPANY_H / 2)
      .attr('rx', 8);

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Merge new nodes, preserving positions of existing ones
    const existingMap = new Map(nodesRef.current.map(n => [n.id, n]));

    // Build adjacency from links so new nodes can be placed near a neighbor
    const neighborMap = new Map<string, string>();
    links.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      if (!neighborMap.has(s)) neighborMap.set(s, t);
      if (!neighborMap.has(t)) neighborMap.set(t, s);
    });

    const mergedNodes: GraphNode[] = nodes.map(n => {
      const existing = existingMap.get(n.id);
      if (existing) {
        return { ...n, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy, fx: existing.fx, fy: existing.fy };
      }
      // Place new node near a connected neighbor, or near center
      const nbId = neighborMap.get(n.id);
      const nb = nbId ? existingMap.get(nbId) : null;
      const cx = nb?.x ?? width / 2;
      const cy = nb?.y ?? height / 2;
      const jitter = 30;
      return { ...n, x: cx + (Math.random() - 0.5) * jitter, y: cy + (Math.random() - 0.5) * jitter };
    });

    const mergedLinks: GraphLink[] = links.map(l => ({ ...l }));

    nodesRef.current = mergedNodes;
    linksRef.current = mergedLinks;

    // Simulation — start cool so nodes don't fly around
    const hasExisting = existingMap.size > 0;
    const simulation = d3.forceSimulation<GraphNode>(mergedNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(mergedLinks).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.08))
      .force('y', d3.forceY(height / 2).strength(0.08))
      .force('collide', d3.forceCollide().radius(50))
      .alpha(hasExisting ? 0.3 : 0.5)
      .alphaDecay(0.05)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    // Links - curved cables with weight/sag
    const link = g.append('g')
      .selectAll<SVGPathElement, GraphLink>('path')
      .data(mergedLinks)
      .join('path')
      .attr('stroke', '#475569')
      .attr('stroke-width', 4)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-linecap', 'round')
      .attr('fill', 'none')
      .attr('cursor', 'pointer');

    // Invisible wider hit area for clicking links
    const linkHitArea = g.append('g')
      .selectAll<SVGPathElement, GraphLink>('path')
      .data(mergedLinks)
      .join('path')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .attr('fill', 'none')
      .attr('cursor', 'pointer');

    // Compute curved path between two points with gravity sag
    function curvedPath(x1: number, y1: number, x2: number, y2: number): string {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Sag amount proportional to distance, capped
      const sag = Math.min(dist * 0.25, 80);
      // Control point: midpoint shifted straight down (positive y = down in SVG)
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2 + sag;
      return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    }

    // Node groups
    const node = g.append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(mergedNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Person nodes: circle with photo or fallback
    const personNodes = node.filter(d => d.type === 'person');

    // Background circle (visible when no image or as border)
    personNodes.append('circle')
      .attr('r', NODE_RADIUS + 2)
      .attr('fill', 'none')
      .attr('stroke', d => d.expanded ? '#f59e0b' : '#92400e')
      .attr('stroke-width', 3);

    // Fallback circle fill
    personNodes.append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', d => d.expanded ? '#78350f' : '#451a03');

    // Person initials (visible when image fails)
    personNodes.append('text')
      .attr('class', 'initials')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fbbf24')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(d => d.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase());

    // Photo image (clipped to circle)
    personNodes.filter(d => !!d.imageUrl)
      .append('image')
      .attr('href', d => d.imageUrl!)
      .attr('x', -NODE_RADIUS)
      .attr('y', -NODE_RADIUS)
      .attr('width', NODE_RADIUS * 2)
      .attr('height', NODE_RADIUS * 2)
      .attr('clip-path', 'url(#clip-circle)')
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .on('error', function () {
        // On image load failure, remove the image element (initials will show)
        d3.select(this).remove();
      });

    // Company nodes: rounded rect with logo or fallback
    const companyNodes = node.filter(d => d.type === 'company');

    // Background rect (border)
    companyNodes.append('rect')
      .attr('width', COMPANY_W + 4)
      .attr('height', COMPANY_H + 4)
      .attr('x', -(COMPANY_W + 4) / 2)
      .attr('y', -(COMPANY_H + 4) / 2)
      .attr('rx', 10)
      .attr('fill', 'none')
      .attr('stroke', d => d.expanded ? '#3b82f6' : '#1e3a5f')
      .attr('stroke-width', 3);

    // Fallback rect fill
    companyNodes.append('rect')
      .attr('width', COMPANY_W)
      .attr('height', COMPANY_H)
      .attr('x', -COMPANY_W / 2)
      .attr('y', -COMPANY_H / 2)
      .attr('rx', 8)
      .attr('fill', d => d.expanded ? '#1e3a5f' : '#0f172a');

    // Company initial letter (visible when logo fails)
    companyNodes.append('text')
      .attr('class', 'initials')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#60a5fa')
      .attr('font-size', '16px')
      .attr('font-weight', '700')
      .text(d => d.name[0].toUpperCase());

    // Logo image (clipped to rounded rect)
    companyNodes.filter(d => !!d.imageUrl)
      .append('image')
      .attr('href', d => d.imageUrl!)
      .attr('x', -COMPANY_W / 2)
      .attr('y', -COMPANY_H / 2)
      .attr('width', COMPANY_W)
      .attr('height', COMPANY_H)
      .attr('clip-path', 'url(#clip-rect)')
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .on('error', function () {
        d3.select(this).remove();
      });

    // Loading spinner — dashed circle that rotates around the node
    const spinner = node.append('g')
      .attr('class', 'spinner-group')
      .style('display', d => d.isLoading ? 'block' : 'none');

    spinner.append('circle')
      .attr('fill', 'none')
      .attr('stroke', d => d.type === 'person' ? '#fbbf24' : '#60a5fa')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '8 12')
      .attr('stroke-linecap', 'round')
      .attr('r', d => d.type === 'person' ? NODE_RADIUS + 8 : COMPANY_W / 2 + 8);

    spinner.append('animateTransform')
      .attr('attributeName', 'transform')
      .attr('type', 'rotate')
      .attr('from', '0 0 0')
      .attr('to', '360 0 0')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');

    // Labels below nodes — split into two lines at a word boundary
    function splitLabel(name: string): string[] {
      if (name.length <= 12) return [name];
      const words = name.split(/\s+/);
      if (words.length === 1) return [name.length > 16 ? name.slice(0, 14) + '...' : name];
      // Find the split point closest to the middle
      let best = 0;
      let bestDiff = Infinity;
      let running = 0;
      for (let i = 0; i < words.length - 1; i++) {
        running += words[i].length + 1;
        const diff = Math.abs(running - name.length / 2);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      }
      const line1 = words.slice(0, best + 1).join(' ');
      const line2 = words.slice(best + 1).join(' ');
      return [
        line1.length > 16 ? line1.slice(0, 14) + '...' : line1,
        line2.length > 16 ? line2.slice(0, 14) + '...' : line2,
      ];
    }

    const label = node.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0')
      .attr('font-size', '11px')
      .attr('font-weight', '400')
      .style('text-shadow', '0 1px 4px rgba(0,0,0,0.9)');

    label.each(function (d) {
      const lines = splitLabel(d.name);
      const baseY = d.type === 'person' ? NODE_RADIUS + 14 : COMPANY_H / 2 + 14;
      const el = d3.select(this);
      lines.forEach((line, i) => {
        el.append('tspan')
          .attr('x', 0)
          .attr('dy', i === 0 ? baseY : 13)
          .text(line);
      });
    });

    // Click handler for nodes
    node.on('click', (_event, d) => {
      _event.stopPropagation();
      onNodeClick(d);
    });

    // Link interaction: hover + click
    function handleLinkHover(this: SVGPathElement, _event: MouseEvent, d: GraphLink) {
      d3.select(link.nodes()[mergedLinks.indexOf(d)])
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 6)
        .attr('stroke-opacity', 0.9);
    }
    function handleLinkLeave(this: SVGPathElement, _event: MouseEvent, d: GraphLink) {
      d3.select(link.nodes()[mergedLinks.indexOf(d)])
        .attr('stroke', '#475569')
        .attr('stroke-width', 4)
        .attr('stroke-opacity', 0.5);
    }
    function handleLinkClick(this: SVGPathElement, _event: MouseEvent, d: GraphLink) {
      _event.stopPropagation();
      if (onLinkClick) onLinkClick(d);
    }

    linkHitArea
      .on('mouseenter', handleLinkHover)
      .on('mouseleave', handleLinkLeave)
      .on('click', handleLinkClick);

    link
      .on('mouseenter', function (_event, d) {
        d3.select(this)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 6)
          .attr('stroke-opacity', 0.9);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .attr('stroke', '#475569')
          .attr('stroke-width', 4)
          .attr('stroke-opacity', 0.5);
      })
      .on('click', handleLinkClick);

    // Click on background to deselect
    svg.on('click', () => {
      onNodeClick({ id: '', type: 'person', name: '', expanded: false } as GraphNode);
    });

    // Selection highlighting
    function updateHighlighting() {
      if (selectedNodeId) {
        const neighbors = getNeighborIds(selectedNodeId);
        node.attr('opacity', d => neighbors.has(d.id) ? 1 : 0.2);
        link.attr('opacity', d => {
          const sid = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
          const tid = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
          return sid === selectedNodeId || tid === selectedNodeId ? 0.8 : 0.1;
        });
        linkHitArea.attr('opacity', d => {
          const sid = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
          const tid = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
          return sid === selectedNodeId || tid === selectedNodeId ? 1 : 0.1;
        });
      } else {
        node.attr('opacity', 1);
        link.attr('opacity', 0.5);
        linkHitArea.attr('opacity', 1);
      }
    }

    updateHighlighting();

    // Tick
    simulation.on('tick', () => {
      link.attr('d', d => {
        const s = d.source as GraphNode;
        const t = d.target as GraphNode;
        return curvedPath(s.x!, s.y!, t.x!, t.y!);
      });

      linkHitArea.attr('d', d => {
        const s = d.source as GraphNode;
        const t = d.target as GraphNode;
        return curvedPath(s.x!, s.y!, t.x!, t.y!);
      });

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, selectedNodeId, onNodeClick, onLinkClick, getNeighborIds]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-slate-900"
    />
  );
}
