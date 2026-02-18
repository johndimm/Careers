import { NextRequest, NextResponse } from 'next/server';
import { generateJSONWithFallback } from '@/lib/llm/registry';
import { intersectionPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { parseIntersectionResponse, normalize } from '@/lib/parsers';
import { IntersectionLLMResponse, ProviderName } from '@/lib/llm/types';
import { searchIntersection } from '@/lib/search';

export async function POST(request: NextRequest) {
  try {
    const { personName, companyName, provider: providerName } = await request.json();
    if (!personName || !companyName) {
      return NextResponse.json({ error: 'personName and companyName are required' }, { status: 400 });
    }

    // Search the web for real data
    const searchContext = await searchIntersection(personName, companyName);

    // Call LLM
    const prompt = intersectionPrompt(personName, companyName, searchContext);
    const { result: raw } = await generateJSONWithFallback<IntersectionLLMResponse>(
      (providerName || 'deepseek') as ProviderName,
      prompt,
      SYSTEM_PROMPT,
    );
    const parsed = parseIntersectionResponse(raw);

    // Add normalized names to connections
    const connections = parsed.connections.map(c => ({
      ...c,
      personNameNormalized: normalize(c.person_name),
    }));

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Person-company intersection error:', error);
    return NextResponse.json({ error: 'Failed to find connections' }, { status: 500 });
  }
}
