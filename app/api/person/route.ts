import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/llm/registry';
import { personPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { parsePersonResponse, normalize, normalizeCompany } from '@/lib/parsers';
import { PersonLLMResponse, ProviderName } from '@/lib/llm/types';
import { searchPerson } from '@/lib/search';
import { findPersonPhotoUrl, findCompanyLogoUrl } from '@/lib/images';

export async function POST(request: NextRequest) {
  try {
    const { name, provider: providerName, excludeCompanies } = await request.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const nameNorm = normalize(name);

    // Search the web for real data
    const searchContext = await searchPerson(name);

    // Call LLM with search context
    const provider = getProvider((providerName || 'anthropic') as ProviderName);
    const prompt = personPrompt(name, searchContext, excludeCompanies);
    const raw = await provider.generateJSON<PersonLLMResponse>(prompt, SYSTEM_PROMPT);
    const parsed = parsePersonResponse(raw);

    // Get photo URL for person
    const photoUrl = await findPersonPhotoUrl(parsed.name);

    // Build company data with logos and normalized names (parallel lookups)
    const companies = await Promise.all(
      parsed.companies.map(async c => ({
        companyName: c.company_name,
        companyNameNormalized: normalizeCompany(c.company_name),
        logoUrl: await findCompanyLogoUrl(c.company_name),
        position: c.position,
        startYear: c.start_year,
        endYear: c.end_year,
        projects: c.projects,
        coworkers: c.coworkers,
        reportsTo: c.reports_to,
        performanceComments: c.performance_comments,
      }))
    );

    return NextResponse.json({
      person: {
        name: parsed.name,
        nameNormalized: nameNorm,
        summary: parsed.summary,
        photoUrl,
        companies,
      },
    });
  } catch (error) {
    console.error('Person lookup error:', error);
    const message = error instanceof Error ? error.message : 'Failed to lookup person';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
