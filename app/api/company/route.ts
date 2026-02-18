import { NextRequest } from 'next/server';
import { generateJSONWithFallback } from '@/lib/llm/registry';
import { companyPrompt, SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { parseCompanyResponse, normalize, normalizeCompany } from '@/lib/parsers';
import { CompanyLLMResponse, ProviderName } from '@/lib/llm/types';
import { searchCompany } from '@/lib/search';
import { findPersonPhotoUrl, findCompanyLogoUrl } from '@/lib/images';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const { name, provider: providerName, excludeNames } = await request.json();
        if (!name || typeof name !== 'string') {
          send('error', { error: 'Name is required' });
          controller.close();
          return;
        }

        const nameNorm = normalizeCompany(name);

        // Phase 1: Web search — stream individual source progress
        const searchContext = await searchCompany(name, (msg, done) => {
          send('progress', { step: msg, phase: 'search', ...(done ? { done: true } : {}) });
        });
        send('progress', { step: 'Web search complete', phase: 'search', done: true });

        // Phase 2: LLM extraction
        send('progress', { step: 'Extracting company data...', phase: 'llm' });
        const prompt = companyPrompt(name, searchContext, excludeNames);
        const { result: raw, usedModel } = await generateJSONWithFallback<CompanyLLMResponse>(
          (providerName || 'anthropic') as ProviderName,
          prompt,
          SYSTEM_PROMPT,
        );
        const parsed = parseCompanyResponse(raw);
        send('progress', {
          step: `Found ${parsed.notable_people.length} people (${usedModel})`,
          phase: 'llm',
          done: true,
        });

        // Phase 3: Images — logo + person photos in parallel
        const imgProgress = (msg: string, done?: boolean) => {
          send('progress', { step: msg, phase: 'images', ...(done ? { done: true } : {}) });
        };

        const [logoUrl, ...personPhotos] = await Promise.all([
          findCompanyLogoUrl(parsed.name, imgProgress),
          ...parsed.notable_people.map(p =>
            findPersonPhotoUrl(p.person_name, [parsed.name], undefined, imgProgress)
          ),
        ]);

        const notablePeople = parsed.notable_people.map((p, i) => ({
          personName: p.person_name,
          personNameNormalized: normalize(p.person_name),
          photoUrl: personPhotos[i],
          position: p.position,
          startYear: p.start_year,
          endYear: p.end_year,
          projects: p.projects,
          coworkers: p.coworkers,
          reportsTo: p.reports_to,
        }));

        // Final result
        send('result', {
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
        const message = error instanceof Error ? error.message : 'Failed to lookup company';
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
