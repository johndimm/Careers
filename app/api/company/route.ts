import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/llm/registry';
import { companyPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { parseCompanyResponse, normalize, normalizeCompany } from '@/lib/parsers';
import { CompanyLLMResponse, ProviderName } from '@/lib/llm/types';
import { searchCompany } from '@/lib/search';
import { findPersonPhotoUrl, findCompanyLogoUrl } from '@/lib/images';

export async function POST(request: NextRequest) {
  try {
    const { name, provider: providerName, excludeNames } = await request.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const nameNorm = normalizeCompany(name);

    // Search the web for real data
    const searchContext = await searchCompany(name);

    // Call LLM with search context
    const provider = getProvider((providerName || 'anthropic') as ProviderName);
    const prompt = companyPrompt(name, searchContext, excludeNames);
    const raw = await provider.generateJSON<CompanyLLMResponse>(prompt, SYSTEM_PROMPT);
    const parsed = parseCompanyResponse(raw);

    // Get logo URL (validated)
    const logoUrl = await findCompanyLogoUrl(parsed.name);

    // Build notable people data with photos and normalized names
    const notablePeople = await Promise.all(
      parsed.notable_people.map(async p => ({
        personName: p.person_name,
        personNameNormalized: normalize(p.person_name),
        photoUrl: await findPersonPhotoUrl(p.person_name),
        position: p.position,
        startYear: p.start_year,
        endYear: p.end_year,
        projects: p.projects,
        coworkers: p.coworkers,
        reportsTo: p.reports_to,
      }))
    );

    return NextResponse.json({
      company: {
        name: parsed.name,
        nameNormalized: nameNorm,
        description: parsed.description,
        products: parsed.products,
        history: parsed.history,
        logoUrl,
        notablePeople,
      },
    });
  } catch (error) {
    console.error('Company lookup error:', error);
    return NextResponse.json({ error: 'Failed to lookup company' }, { status: 500 });
  }
}
