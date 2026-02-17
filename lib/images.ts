// Find photos for people and logos for companies
//
// People:  Wikipedia page image → DuckDuckGo Image Search
// Companies: DuckDuckGo Instant Answer → Google Favicon V2 → Wikipedia page image

const UA = 'CareersGraph/1.0 (https://github.com)';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a URL actually returns an image via HEAD request.
 */
export async function validateImageUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.startsWith('image/')) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search Wikipedia and return the page image thumbnail for the top result.
 */
async function fetchWikipediaImage(query: string, thumbSize: number = 400): Promise<string | null> {
  try {
    // Step 1: search for the article
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&origin=*`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    const results = searchData?.query?.search;
    if (!results?.length) return null;
    const title: string = results[0].title;

    // Step 2: get page image
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(title)}&pithumbsize=${thumbSize}&redirects=1&origin=*`;
    const imgRes = await fetch(imgUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!imgRes.ok) return null;
    const imgData = await imgRes.json();

    const pages = imgData?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as { thumbnail?: { source?: string } };
    return page?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

/**
 * Query the DuckDuckGo Instant Answer API for an entity image.
 * Returns a validated image URL or null.
 */
async function fetchDuckDuckGoImage(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const image: string = data?.Image || '';
    if (!image) return null;

    // DDG returns paths like "/i/abc123.png" — prepend host
    const fullUrl = image.startsWith('http') ? image : `https://duckduckgo.com${image}`;
    return await validateImageUrl(fullUrl);
  } catch {
    return null;
  }
}

/**
 * DuckDuckGo Image Search — fetches actual image search results.
 * Two-step: get a vqd token from the search page, then call the i.js API.
 */
async function fetchDuckDuckGoImageSearch(
  query: string,
  limit: number = 10
): Promise<Array<{ image?: string; thumbnail?: string; title?: string }>> {
  const headers = {
    'User-Agent': BROWSER_UA,
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    // Step 1: fetch DDG search page to extract vqd token
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const pageRes = await fetch(searchUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!pageRes.ok) return [];
    const pageText = await pageRes.text();
    const vqdMatch = pageText.match(/vqd=['"]?([^'"&]+)/);
    const vqd = vqdMatch?.[1];
    if (!vqd) return [];

    // Step 2: call the image search API
    const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        ...headers,
        Referer: searchUrl,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!apiRes.ok) return [];
    const data = await apiRes.json();
    const results: Array<{ image?: string; thumbnail?: string; title?: string }> = data?.results || [];
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Find a person photo via DDG Image Search, filtering out logos/icons/clipart.
 */
async function fetchPersonImageFromDDGSearch(
  name: string,
  excludeUrls?: Set<string>,
): Promise<string | null> {
  const exclude = ['logo', 'icon', 'emoji', 'svg', 'vector', 'clipart', 'cartoon', 'animated'];
  try {
    const candidates = await fetchDuckDuckGoImageSearch(name, 10);
    for (const r of candidates) {
      const url = String(r?.image || r?.thumbnail || '');
      if (!url) continue;
      if (excludeUrls?.has(url)) continue;
      const lower = url.toLowerCase();
      if (exclude.some(p => lower.includes(p))) continue;
      return url;
    }
  } catch {
    // fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Person photos
// ---------------------------------------------------------------------------

/**
 * Find a photo for a person.
 * Tries: Wikipedia page image → DuckDuckGo Instant Answer → DuckDuckGo Image Search.
 */
export async function findPersonPhotoUrl(name: string): Promise<string | null> {
  // Try Wikipedia page image (works well for notable people)
  const wikiImg = await fetchWikipediaImage(name, 400);
  if (wikiImg) return wikiImg;

  // Try DuckDuckGo Instant Answer (sometimes has person photos)
  const ddgImg = await fetchDuckDuckGoImage(name);
  if (ddgImg) return ddgImg;

  // Try DuckDuckGo Image Search (finds photos for non-notable people)
  const ddgSearchImg = await fetchPersonImageFromDDGSearch(name);
  if (ddgSearchImg) return ddgSearchImg;

  return null;
}

/**
 * Find an alternate photo for a person, skipping URLs already tried.
 * Runs the same Wikipedia → DDG Instant → DDG Search pipeline but excludes
 * any URLs in the provided list.
 */
export async function findAlternatePersonPhoto(
  name: string,
  exclude: string[],
): Promise<string | null> {
  const excludeSet = new Set(exclude);

  const wikiImg = await fetchWikipediaImage(name, 400);
  if (wikiImg && !excludeSet.has(wikiImg)) return wikiImg;

  const ddgImg = await fetchDuckDuckGoImage(name);
  if (ddgImg && !excludeSet.has(ddgImg)) return ddgImg;

  const ddgSearchImg = await fetchPersonImageFromDDGSearch(name, excludeSet);
  if (ddgSearchImg) return ddgSearchImg;

  return null;
}

// ---------------------------------------------------------------------------
// Company logos
// ---------------------------------------------------------------------------

/**
 * Build a Google Favicon V2 URL for a domain (128px PNG).
 */
function googleFaviconUrl(domain: string): string {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
}

/**
 * Guess a company domain from its name.
 */
function guessCompanyDomain(name: string): string | null {
  const known: Record<string, string> = {
    'google': 'google.com',
    'microsoft': 'microsoft.com',
    'apple': 'apple.com',
    'amazon': 'amazon.com',
    'meta': 'meta.com',
    'facebook': 'facebook.com',
    'netflix': 'netflix.com',
    'tesla': 'tesla.com',
    'websense': 'websense.com',
    'encyclopaedia britannica': 'britannica.com',
    'encyclopaedia britannica, inc.': 'britannica.com',
    'veoh networks': 'veoh.com',
    'systran': 'systrangroup.com',
    'zuora': 'zuora.com',
    'gardyn': 'mygardyn.com',
    'acculitx': 'acculitx.com',
    'photometria': 'photometria.com',
    'nss labs': 'nsslabs.com',
    'nss labs, inc.': 'nsslabs.com',
    'accuknox': 'accuknox.com',
    'acalvio technologies': 'acalvio.com',
    'tempered': 'tempered.io',
    'packetsled': 'packetsled.com',
    'deeplight digital': 'deeplightdigital.com',
    'eset': 'eset.com',
    'eset security': 'eset.com',
    'protego networks': 'protego.com',
    'preventsys': 'preventsys.com',
    'lucid security': 'lucidsecurity.com',
  };

  const lower = name.toLowerCase()
    .replace(/,?\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?)$/i, '')
    .trim();

  if (known[lower]) return known[lower];

  const slug = lower.replace(/[^a-z0-9]/g, '');
  if (slug.length >= 3) return `${slug}.com`;
  return null;
}

/**
 * Get a company logo URL (synchronous, no validation).
 */
export function getCompanyLogoUrl(companyName: string, domain?: string): string {
  const d = domain || guessCompanyDomain(companyName);
  if (d) return googleFaviconUrl(d);
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return googleFaviconUrl(`${slug}.com`);
}

/**
 * Find and validate a company logo.
 * Tries: DuckDuckGo Instant Answer → Google Favicon → Wikipedia page image.
 */
export async function findCompanyLogoUrl(companyName: string): Promise<string | null> {
  // 1. DuckDuckGo Instant Answer (good quality entity images)
  const ddgImg = await fetchDuckDuckGoImage(companyName);
  if (ddgImg) return ddgImg;

  // 2. Google Favicon V2 (reliable for active domains)
  const domain = guessCompanyDomain(companyName);
  if (domain) {
    const favUrl = googleFaviconUrl(domain);
    const validated = await validateImageUrl(favUrl);
    if (validated) return validated;
  }

  // 3. Try slug-based domain favicon
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (slug.length >= 3 && slug + '.com' !== domain) {
    const favUrl = googleFaviconUrl(`${slug}.com`);
    const validated = await validateImageUrl(favUrl);
    if (validated) return validated;
  }

  // 4. Wikipedia page image (useful for defunct companies with articles)
  const wikiImg = await fetchWikipediaImage(companyName, 200);
  if (wikiImg) return wikiImg;

  return null;
}

/**
 * Try to extract a company domain from search results text.
 */
export function extractDomainFromText(companyName: string, text: string): string | null {
  const lower = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const urlRegex = /https?:\/\/(?:www\.)?([a-z0-9][-a-z0-9]*\.(?:com|io|org|net|co))\b/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const domain = match[1].toLowerCase();
    const domainBase = domain.replace(/\.(?:com|io|org|net|co)$/, '').replace(/[^a-z0-9]/g, '');
    if (domainBase.includes(lower.slice(0, 5)) || lower.includes(domainBase.slice(0, 5))) {
      return domain;
    }
  }
  return null;
}
