import Exa from 'exa-js';

let exa: Exa | null = null;

function getExa(): Exa {
  if (!exa) {
    exa = new Exa(process.env.EXA_API_KEY!);
  }
  return exa;
}

// Decode HTML entities
function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Scrape DuckDuckGo HTML search results - free, no API key, indexes LinkedIn via third-party sites
async function duckDuckGoSearch(query: string): Promise<{ snippets: string[]; urls: string[] }> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();

    const snippets: string[] = [];
    const urls: string[] = [];

    // Extract snippets - the snippet is an <a> tag with class="result__snippet"
    // Content can contain <b> tags for bold keywords. Use a greedy match up to </a>.
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = snippetRegex.exec(html)) !== null) {
      const text = decodeEntities(match[1]);
      if (text) snippets.push(text);
    }

    // Extract unique destination URLs from uddg parameters
    const seen = new Set<string>();
    const urlRegex = /uddg=([^&"'\s]+)/g;
    while ((match = urlRegex.exec(html)) !== null) {
      try {
        const url = decodeURIComponent(match[1]);
        if (!seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
      } catch { /* skip malformed URLs */ }
    }

    console.log(`[DDG] Query: "${query}" → ${snippets.length} snippets, ${urls.length} URLs`);
    if (snippets.length > 0) {
      console.log(`[DDG] First snippet (${snippets[0].length} chars): ${snippets[0].slice(0, 200)}...`);
    }
    for (const u of urls) {
      console.log(`[DDG] URL: ${u}`);
    }

    return { snippets, urls };
  } catch (e) {
    console.error('DuckDuckGo search error:', e);
    return { snippets: [], urls: [] };
  }
}

// Fetch a URL and extract text content
async function fetchPageText(url: string, maxLength: number = 5000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareersGraph/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    // Strip tags, scripts, styles
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, maxLength);
  } catch {
    return '';
  }
}

// Try to find and fetch LinkedIn profile content via Exa
async function fetchLinkedInViaExa(name: string): Promise<string> {
  try {
    // Search for the person's LinkedIn URL
    const searchResult = await getExa().search(
      `${name} LinkedIn profile`,
      { type: 'keyword', numResults: 3 }
    );

    // Find LinkedIn URLs in results
    const linkedinUrls = searchResult.results
      .filter(r => r.url.includes('linkedin.com/in/'))
      .map(r => r.url);

    if (linkedinUrls.length === 0) {
      // Try constructing common LinkedIn URL patterns
      const slug = name.toLowerCase().replace(/\s+/g, '');
      linkedinUrls.push(`https://www.linkedin.com/in/${slug}`);
    }

    // Use Exa getContents to fetch LinkedIn page (Exa can index LinkedIn)
    const contents = await getExa().getContents(
      linkedinUrls.slice(0, 1),
      { text: { maxCharacters: 10000 } }
    );

    if (contents.results.length > 0 && contents.results[0].text) {
      const text = contents.results[0].text;
      console.log(`[Search] Fetched LinkedIn via Exa: ${text.length} chars from ${contents.results[0].url}`);
      return `[LinkedIn Profile via Exa]\n${text}`;
    }
    return '';
  } catch (e) {
    console.error('[Search] LinkedIn via Exa failed:', e);
    return '';
  }
}

export type ProgressCallback = (message: string, done?: boolean) => void;

export async function searchPerson(name: string, onProgress?: ProgressCallback): Promise<string> {
  const report = onProgress || (() => {});

  // Run DDG + Exa search + LinkedIn fetch in parallel, reporting each as it completes
  report('DuckDuckGo: career history...');
  report('Exa: neural + keyword search...');
  report('Exa: LinkedIn profile...');

  const [ddgResult, exaResults, linkedinContent] = await Promise.all([
    duckDuckGoSearch(`${name} career work history employment resume`)
      .then(r => { report(`DuckDuckGo: ${r.snippets.length} snippets, ${r.urls.length} URLs`, true); return r; }),
    exaSearchPerson(name)
      .then(r => { report(`Exa: ${r ? r.split('\n').filter(l => l.startsWith('[Source')).length : 0} sources`, true); return r; }),
    fetchLinkedInViaExa(name)
      .then(r => { report(r ? 'LinkedIn: profile found' : 'LinkedIn: not found', true); return r; }),
  ]);

  const parts: string[] = [];

  if (linkedinContent) {
    parts.push(linkedinContent);
  }

  if (ddgResult.snippets.length > 0) {
    parts.push(`[DuckDuckGo Search Results]\n${ddgResult.snippets.join('\n')}`);
  }

  // Fetch career-data sites found by DDG
  const interestingUrls = ddgResult.urls.filter(u => {
    if (u.includes('linkedin.com') || u.includes('duckduckgo.com')) return false;
    if (u.endsWith('.pdf') || u.endsWith('.doc') || u.endsWith('.docx')) return false;
    return u.includes('contactout') || u.includes('rocketreach') || u.includes('zoominfo') ||
           u.includes('signalhire') || u.includes('theorg.com') || u.includes('crunchbase') ||
           u.includes('mylife.com') || u.includes('vercel.app') || u.includes('docs.google.com');
  }).slice(0, 3);

  if (interestingUrls.length > 0) {
    report(`Fetching ${interestingUrls.length} career sites...`);
    const pageTexts = await Promise.all(
      interestingUrls.map(async (url) => {
        const domain = new URL(url).hostname.replace('www.', '');
        if (url.includes('docs.google.com/document/d/')) {
          const docMatch = url.match(/\/document\/d\/([^/]+)/);
          if (docMatch) {
            const textUrl = `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`;
            const text = await fetchPageText(textUrl, 10000);
            if (text) { report(`Fetched resume from Google Docs`, true); return `[Resume: Google Doc]\n${text}`; }
          }
        }
        const text = await fetchPageText(url, 8000);
        if (text) report(`Fetched ${domain}`, true);
        return text ? `[Fetched: ${url}]\n${text}` : '';
      })
    );
    for (const pt of pageTexts) {
      if (pt) parts.push(pt);
    }
  }

  if (exaResults) {
    parts.push(exaResults);
  }

  return parts.join('\n\n') || `No web results found for "${name}".`;
}

async function exaSearchPerson(name: string): Promise<string> {
  const searches = [
    getExa().searchAndContents(
      `${name} professional experience resume career history`,
      { type: 'neural', numResults: 5, text: { maxCharacters: 3000 } }
    ).catch(() => ({ results: [] })),
    getExa().searchAndContents(
      `"${name}" work experience companies`,
      { type: 'keyword', numResults: 5, text: { maxCharacters: 3000 } }
    ).catch(() => ({ results: [] })),
    getExa().searchAndContents(
      `"${name}" resume software engineer director`,
      { type: 'keyword', numResults: 3, text: { maxCharacters: 3000 } }
    ).catch(() => ({ results: [] })),
  ];

  try {
    const allResults = await Promise.all(searches);

    const seen = new Set<string>();
    const combined: { title?: string; url: string; text?: string }[] = [];
    for (const batch of allResults) {
      for (const r of batch.results || []) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          combined.push({ title: r.title || undefined, url: r.url, text: r.text || undefined });
        }
      }
    }

    if (combined.length === 0) return '';

    return combined
      .map((r, i) => {
        const text = r.text ? r.text.slice(0, 3000) : '';
        return `[Source ${i + 1}: ${r.title || r.url}]\n${text}`;
      })
      .join('\n\n');
  } catch {
    return '';
  }
}

export async function searchCompany(name: string, onProgress?: ProgressCallback): Promise<string> {
  const report = onProgress || (() => {});

  report('DuckDuckGo: leadership...');
  report('DuckDuckGo: employees...');
  report('Exa: company search...');

  const [ddgLeadership, ddgTeam, ddgLinkedin, exaResult] = await Promise.all([
    duckDuckGoSearch(`${name} company executives founders leadership team`)
      .then(r => { report(`DuckDuckGo leadership: ${r.snippets.length} snippets`, true); return r; }),
    duckDuckGoSearch(`"${name}" employees engineers directors managers site:linkedin.com`)
      .then(r => { report(`DuckDuckGo employees: ${r.snippets.length} snippets`, true); return r; }),
    duckDuckGoSearch(`"${name}" company team members who works at`)
      .then(r => { report(`DuckDuckGo team: ${r.snippets.length} snippets`, true); return r; }),
    exaSearchCompany(name)
      .then(r => { report(`Exa: ${r ? r.split('\n').filter(l => l.startsWith('[Source')).length : 0} sources`, true); return r; }),
  ]);

  const parts: string[] = [];
  if (ddgLeadership.snippets.length > 0) {
    parts.push(`[DuckDuckGo: Leadership]\n${ddgLeadership.snippets.join('\n')}`);
  }
  if (ddgTeam.snippets.length > 0) {
    parts.push(`[DuckDuckGo: Team/Employees]\n${ddgTeam.snippets.join('\n')}`);
  }
  if (ddgLinkedin.snippets.length > 0) {
    parts.push(`[DuckDuckGo: LinkedIn]\n${ddgLinkedin.snippets.join('\n')}`);
  }

  const allUrls = [...new Set([...ddgLeadership.urls, ...ddgTeam.urls, ...ddgLinkedin.urls])];
  const teamPageUrls = allUrls.filter(u => {
    if (u.includes('duckduckgo.com')) return false;
    if (u.endsWith('.pdf') || u.endsWith('.doc')) return false;
    return u.includes('theorg.com') || u.includes('crunchbase') || u.includes('zoominfo') ||
           u.includes('rocketreach') || u.includes('/team') || u.includes('/about') ||
           u.includes('/people') || u.includes('/leadership');
  }).slice(0, 3);

  if (teamPageUrls.length > 0) {
    report(`Fetching ${teamPageUrls.length} team pages...`);
    const pageTexts = await Promise.all(
      teamPageUrls.map(async (url) => {
        const domain = new URL(url).hostname.replace('www.', '');
        const text = await fetchPageText(url, 8000);
        if (text) report(`Fetched ${domain}`, true);
        return text ? `[Fetched: ${url}]\n${text}` : '';
      })
    );
    for (const pt of pageTexts) {
      if (pt) parts.push(pt);
    }
  }

  if (exaResult) {
    parts.push(exaResult);
  }

  return parts.join('\n\n') || `No web results found for "${name}".`;
}

async function exaSearchCompany(name: string): Promise<string> {
  const searches = [
    getExa().searchAndContents(
      `${name} company founders executives leadership team`,
      { type: 'auto', numResults: 5, text: { maxCharacters: 3000 } }
    ).catch(() => ({ results: [] })),
    getExa().searchAndContents(
      `"${name}" employees engineers product design marketing`,
      { type: 'keyword', numResults: 5, text: { maxCharacters: 3000 } }
    ).catch(() => ({ results: [] })),
    getExa().searchAndContents(
      `who works at "${name}" team members staff`,
      { type: 'neural', numResults: 5, text: { maxCharacters: 3000 } }
    ).catch(() => ({ results: [] })),
  ];

  try {
    const allResults = await Promise.all(searches);

    const seen = new Set<string>();
    const combined: { title?: string; url: string; text?: string }[] = [];
    for (const batch of allResults) {
      for (const r of batch.results || []) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          combined.push({ title: r.title || undefined, url: r.url, text: r.text || undefined });
        }
      }
    }

    if (combined.length === 0) return '';

    return combined
      .map((r, i) => {
        const text = r.text ? r.text.slice(0, 3000) : '';
        return `[Source ${i + 1}: ${r.title || r.url}]\n${text}`;
      })
      .join('\n\n');
  } catch {
    return '';
  }
}

export async function searchIntersection(personName: string, companyName: string): Promise<string> {
  const [ddgResult, exaResult] = await Promise.all([
    duckDuckGoSearch(`"${personName}" "${companyName}" colleagues coworkers`),
    exaSearchIntersection(personName, companyName),
  ]);

  const parts: string[] = [];
  if (ddgResult.snippets.length > 0) {
    parts.push(`[DuckDuckGo Search Results]\n${ddgResult.snippets.join('\n')}`);
  }
  if (exaResult) {
    parts.push(exaResult);
  }

  return parts.join('\n\n') || `No web results found for "${personName}" at "${companyName}".`;
}

async function exaSearchIntersection(personName: string, companyName: string): Promise<string> {
  try {
    const results = await getExa().searchAndContents(
      `"${personName}" "${companyName}" colleagues coworkers`,
      { type: 'auto', numResults: 5, text: { maxCharacters: 3000 } }
    );

    if (!results.results || results.results.length === 0) return '';

    return results.results
      .map((r, i) => {
        const text = r.text ? r.text.slice(0, 3000) : '';
        return `[Source ${i + 1}: ${r.title || r.url}]\n${text}`;
      })
      .join('\n\n');
  } catch {
    return '';
  }
}
