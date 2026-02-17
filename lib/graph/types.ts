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
}

export interface GraphLink {
  source: string;
  target: string;
  position?: string;
  startYear?: number | null;
  endYear?: number | null;
  projects?: string[];
  coworkers?: string[];
  reportsTo?: string | null;
  performanceComments?: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
