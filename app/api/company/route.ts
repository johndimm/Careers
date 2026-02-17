import { NextRequest } from 'next/server';
import { getProvider } from '@/lib/llm/registry';
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
        const searchContext = await searchCompany(name, (msg) => {
          send('progress', { step: msg, phase: 'search' });
        });
        send('progress', { step: 'Web search complete', phase: 'search', done: true });

        // Phase 2: LLM extraction
        const provider = getProvider((providerName || 'anthropic') as ProviderName);
        send('progress', { step: `Extracting company data (${provider.model})...`, phase: 'llm' });
        const prompt = companyPrompt(name, searchContext, excludeNames);
        const raw = await provider.generateJSON<CompanyLLMResponse>(prompt, SYSTEM_PROMPT);
        const parsed = parseCompanyResponse(raw);
        send('progress', {
          step: `Found ${parsed.notable_people.length} people`,
          phase: 'llm',
          done: true,
        });

        // Phase 3: Images — logo + person photos in parallel
        send('progress', { step: 'Finding logo and person photos...', phase: 'images' });

        const [logoUrl, notablePeople] = await Promise.all([
          findCompanyLogoUrl(parsed.name),
          Promise.all(
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
          ),
        ]);
        send('progress', { step: 'Images loaded', phase: 'images', done: true });

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
