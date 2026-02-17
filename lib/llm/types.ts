export interface LLMProvider {
  name: string;
  generateJSON<T>(prompt: string, systemPrompt: string): Promise<T>;
}

export type ProviderName = 'anthropic' | 'openai' | 'deepseek' | 'gemini';

export interface PersonLLMResponse {
  name: string;
  summary: string;
  companies: Array<{
    company_name: string;
    position: string;
    start_year: number | null;
    end_year: number | null;
    projects: string[];
    coworkers: string[];
    reports_to: string | null;
    performance_comments: string | null;
  }>;
}

export interface CompanyLLMResponse {
  name: string;
  description: string;
  products: string;
  history: string;
  notable_people: Array<{
    person_name: string;
    position: string;
    start_year: number | null;
    end_year: number | null;
    projects: string[];
    coworkers: string[];
    reports_to: string | null;
  }>;
}

export interface IntersectionLLMResponse {
  connections: Array<{
    person_name: string;
    position: string;
    start_year: number | null;
    end_year: number | null;
    relationship: string;
  }>;
}
