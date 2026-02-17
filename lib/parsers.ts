import { PersonLLMResponse, CompanyLLMResponse, IntersectionLLMResponse } from './llm/types';

export function parsePersonResponse(data: unknown): PersonLLMResponse {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj.name !== 'string') {
    throw new Error('Invalid person response: missing name');
  }

  const companies = Array.isArray(obj.companies) ? obj.companies : [];

  return {
    name: obj.name,
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    companies: companies.map((c: Record<string, unknown>) => ({
      company_name: typeof c.company_name === 'string' ? c.company_name : String(c.company_name || ''),
      position: typeof c.position === 'string' ? c.position : String(c.position || ''),
      start_year: typeof c.start_year === 'number' ? c.start_year : null,
      end_year: typeof c.end_year === 'number' ? c.end_year : null,
      projects: Array.isArray(c.projects) ? c.projects.map(String) : [],
      coworkers: Array.isArray(c.coworkers) ? c.coworkers.map(String) : [],
      reports_to: typeof c.reports_to === 'string' ? c.reports_to : null,
      performance_comments: typeof c.performance_comments === 'string' ? c.performance_comments : null,
    })),
  };
}

export function parseCompanyResponse(data: unknown): CompanyLLMResponse {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj.name !== 'string') {
    throw new Error('Invalid company response: missing name');
  }

  const people = Array.isArray(obj.notable_people) ? obj.notable_people : [];

  return {
    name: obj.name,
    description: typeof obj.description === 'string' ? obj.description : '',
    products: typeof obj.products === 'string' ? obj.products : '',
    history: typeof obj.history === 'string' ? obj.history : '',
    notable_people: people.map((p: Record<string, unknown>) => ({
      person_name: typeof p.person_name === 'string' ? p.person_name : String(p.person_name || ''),
      position: typeof p.position === 'string' ? p.position : String(p.position || ''),
      start_year: typeof p.start_year === 'number' ? p.start_year : null,
      end_year: typeof p.end_year === 'number' ? p.end_year : null,
      projects: Array.isArray(p.projects) ? p.projects.map(String) : [],
      coworkers: Array.isArray(p.coworkers) ? p.coworkers.map(String) : [],
      reports_to: typeof p.reports_to === 'string' ? p.reports_to : null,
    })),
  };
}

export function parseIntersectionResponse(data: unknown): IntersectionLLMResponse {
  const obj = data as Record<string, unknown>;
  const connections = Array.isArray(obj?.connections) ? obj.connections : [];

  return {
    connections: connections.map((c: Record<string, unknown>) => ({
      person_name: typeof c.person_name === 'string' ? c.person_name : String(c.person_name || ''),
      position: typeof c.position === 'string' ? c.position : String(c.position || ''),
      start_year: typeof c.start_year === 'number' ? c.start_year : null,
      end_year: typeof c.end_year === 'number' ? c.end_year : null,
      relationship: typeof c.relationship === 'string' ? c.relationship : '',
    })),
  };
}

export function normalize(name: string): string {
  return name.trim().toLowerCase()
    .replace(/\./g, '')              // "John H. Dimm" → "John H Dimm"
    .replace(/\s+/g, ' ')
    .replace(/\s+(jr|sr|ii|iii|iv|phd|md|esq)$/i, '')  // strip suffixes
    .replace(/\b[a-z]\b/g, '')       // remove single-letter middle initials
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize company names more aggressively to deduplicate variants
export function normalizeCompany(name: string): string {
  return name.trim().toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/,?\s*(inc|llc|ltd|corp|co|corporation|incorporated|limited|company|group|holdings)$/i, '')
    .replace(/\s+(technologies|technology|security|networks|systems|solutions|software|labs|digital|media|studios|services|consulting|partners|ventures|international|global|usa|us)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
