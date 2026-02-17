import { NextRequest, NextResponse } from 'next/server';

// Individual service implementations — import the raw functions
import Exa from 'exa-js';

const UA = 'CareersGraph/1.0 (https://github.com)';

let exa: Exa | null = null;
function getExa(): Exa {
  if (!exa) exa = new Exa(process.env.EXA_API_KEY!);
  return exa;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, '/').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
    .trim();
}

// Each service handler returns its raw output
const services: Record<string, (query: string) => Promise<unknown>> = {

  'ddg-search': async (query: string) => {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const snippets: string[] = [];
    const urls: string[] = [];
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = snippetRegex.exec(html)) !== null) {
      const text = decodeEntities(match[1]);
      if (text) snippets.push(text);
    }
    const seen = new Set<string>();
    const urlRegex = /uddg=([^&"'\s]+)/g;
    while ((match = urlRegex.exec(html)) !== null) {
      try {
        const url = decodeURIComponent(match[1]);
        if (!seen.has(url)) { seen.add(url); urls.push(url); }
      } catch { /* skip */ }
    }
    return { snippets: snippets.slice(0, 5), urls: urls.slice(0, 5) };
  },

  'ddg-instant-answer': async (query: string) => {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    return {
      heading: data.Heading,
      abstract: data.Abstract,
      abstractSource: data.AbstractSource,
      image: data.Image ? (data.Image.startsWith('http') ? data.Image : `https://duckduckgo.com${data.Image}`) : null,
      relatedTopics: (data.RelatedTopics || []).slice(0, 3).map((t: { Text?: string }) => t.Text),
    };
  },

  'exa-neural': async (query: string) => {
    const result = await getExa().searchAndContents(
      query,
      { type: 'neural', numResults: 3, text: { maxCharacters: 1000 } }
    );
    return result.results.map(r => ({
      title: r.title,
      url: r.url,
      text: r.text?.slice(0, 500),
    }));
  },

  'exa-keyword': async (query: string) => {
    const result = await getExa().searchAndContents(
      query,
      { type: 'keyword', numResults: 3, text: { maxCharacters: 1000 } }
    );
    return result.results.map(r => ({
      title: r.title,
      url: r.url,
      text: r.text?.slice(0, 500),
    }));
  },

  'exa-linkedin': async (query: string) => {
    const searchResult = await getExa().search(
      `${query} LinkedIn profile`,
      { type: 'keyword', numResults: 3 }
    );
    const linkedinUrls = searchResult.results
      .filter(r => r.url.includes('linkedin.com'))
      .map(r => ({ title: r.title, url: r.url }));

    if (linkedinUrls.length === 0) return { message: 'No LinkedIn results found', results: [] };

    const contents = await getExa().getContents(
      linkedinUrls.slice(0, 1).map(r => r.url),
      { text: { maxCharacters: 2000 } }
    );
    return {
      results: contents.results.map(r => ({
        url: r.url,
        text: r.text?.slice(0, 800),
      })),
    };
  },

  'wikipedia-image': async (query: string) => {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&origin=*`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results?.length) return { found: false };
    const title = results[0].title;

    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(title)}&pithumbsize=400&redirects=1&origin=*`;
    const imgRes = await fetch(imgUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    const imgData = await imgRes.json();
    const pages = imgData?.query?.pages;
    const page = pages ? Object.values(pages)[0] as { title?: string; thumbnail?: { source?: string } } : null;
    return {
      found: true,
      articleTitle: title,
      imageUrl: page?.thumbnail?.source || null,
    };
  },

  'google-favicon': async (query: string) => {
    const domain = query.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const url = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    const contentType = res.headers.get('content-type') || '';
    return {
      domain,
      faviconUrl: url,
      valid: res.ok && contentType.startsWith('image/'),
      contentType,
    };
  },
};

export async function POST(request: NextRequest) {
  try {
    const { service, query } = await request.json();
    if (!service || !query) {
      return NextResponse.json({ error: 'service and query required' }, { status: 400 });
    }
    const handler = services[service];
    if (!handler) {
      return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 400 });
    }
    const result = await handler(query);
    return NextResponse.json({ service, query, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Service call failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
