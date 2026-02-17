import { queryMany } from '../db';
import { GraphData, GraphNode, GraphLink } from './types';

interface PersonRow {
  id: string;
  name: string;
  summary: string | null;
  photo_url: string | null;
  raw_llm_response: unknown | null;
}

interface CompanyRow {
  id: string;
  name: string;
  description: string | null;
  products: string | null;
  history: string | null;
  logo_url: string | null;
  raw_llm_response: unknown | null;
}

interface EdgeRow {
  person_id: string;
  company_id: string;
  position: string | null;
  start_year: number | null;
  end_year: number | null;
  projects: string[] | null;
  coworkers: string[] | null;
  reports_to: string | null;
  performance_comments: string | null;
}

export async function buildGraph(): Promise<GraphData> {
  const [persons, companies, edges] = await Promise.all([
    queryMany<PersonRow>('SELECT id, name, summary, photo_url, raw_llm_response FROM persons'),
    queryMany<CompanyRow>('SELECT id, name, description, products, history, logo_url, raw_llm_response FROM companies'),
    queryMany<EdgeRow>('SELECT person_id, company_id, position, start_year, end_year, projects, coworkers, reports_to, performance_comments FROM person_company_edges'),
  ]);

  const nodes: GraphNode[] = [
    ...persons.map(p => ({
      id: p.id,
      type: 'person' as const,
      name: p.name,
      expanded: p.raw_llm_response != null,
      summary: p.summary || undefined,
      imageUrl: p.photo_url || undefined,
    })),
    ...companies.map(c => ({
      id: c.id,
      type: 'company' as const,
      name: c.name,
      expanded: c.raw_llm_response != null,
      description: c.description || undefined,
      products: c.products || undefined,
      history: c.history || undefined,
      imageUrl: c.logo_url || undefined,
    })),
  ];

  const links: GraphLink[] = edges.map(e => ({
    source: e.person_id,
    target: e.company_id,
    position: e.position || undefined,
    startYear: e.start_year,
    endYear: e.end_year,
    projects: e.projects || undefined,
    coworkers: e.coworkers || undefined,
    reportsTo: e.reports_to || undefined,
    performanceComments: e.performance_comments || undefined,
  }));

  return { nodes, links };
}
