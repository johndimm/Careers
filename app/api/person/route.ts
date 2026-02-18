import { NextRequest } from 'next/server';
import { generateJSONWithFallback } from '@/lib/llm/registry';
import { personPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { parsePersonResponse, normalize, normalizeCompany } from '@/lib/parsers';
import { PersonLLMResponse, ProviderName } from '@/lib/llm/types';
import { searchPerson } from '@/lib/search';
import { findPersonPhotoUrl, findCompanyLogoUrl } from '@/lib/images';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const { name, provider: providerName, excludeCompanies } = await request.json();
        if (!name || typeof name !== 'string') {
          send('error', { error: 'Name is required' });
          controller.close();
          return;
        }

        const nameNorm = normalize(name);

        // Phase 1: Web search — stream individual source progress
        const searchContext = await searchPerson(name, (msg) => {
          send('progress', { step: msg, phase: 'search' });
        });
        send('progress', { step: 'Web search complete', phase: 'search', done: true });

        // Phase 2: LLM extraction
        send('progress', { step: 'Extracting career data...', phase: 'llm' });
        const prompt = personPrompt(name, searchContext, excludeCompanies);
        const { result: raw, usedModel } = await generateJSONWithFallback<PersonLLMResponse>(
          (providerName || 'anthropic') as ProviderName,
          prompt,
          SYSTEM_PROMPT,
        );
        const parsed = parsePersonResponse(raw);
        send('progress', {
          step: `Found ${parsed.companies.length} companies (${usedModel})`,
          phase: 'llm',
          done: true,
        });

        // Phase 3: Images — person photo + company logos in parallel
        send('progress', { step: `Finding photo for ${parsed.name}...`, phase: 'images' });
        for (const c of parsed.companies) {
          send('progress', { step: `Finding logo for ${c.company_name}...`, phase: 'images' });
        }

        const [photoUrl, ...companyLogos] = await Promise.all([
          findPersonPhotoUrl(parsed.name).then(url => {
            send('progress', { step: `Photo for ${parsed.name}` + (url ? '' : ' (not found)'), phase: 'images', done: true });
            return url;
          }),
          ...parsed.companies.map(c =>
            findCompanyLogoUrl(c.company_name).then(url => {
              send('progress', { step: `Logo for ${c.company_name}` + (url ? '' : ' (not found)'), phase: 'images', done: true });
              return url;
            })
          ),
        ]);

        const companies = parsed.companies.map((c, i) => ({
          companyName: c.company_name,
          companyNameNormalized: normalizeCompany(c.company_name),
          logoUrl: companyLogos[i],
          position: c.position,
          startYear: c.start_year,
          endYear: c.end_year,
          projects: c.projects,
          coworkers: c.coworkers,
          reportsTo: c.reports_to,
          performanceComments: c.performance_comments,
        }));

        // Final result
        send('result', {
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
        send('error', { error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
