import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse');

/**
 * POST /api/resume — fetch a resume URL and extract the person's name.
 * Body: { url: string }
 * Returns: { name: string } or { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the URL
    const res = await fetch(url.trim(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareersGraph/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${res.status}` }, { status: 502 });
    }

    let text: string;
    const contentType = res.headers.get('content-type') || '';
    const isPdf = contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const data = await pdfParse(buffer);
      text = data.text;
    } else {
      const html = await res.text();
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Extract name from the first non-empty line
    // Most resumes have the person's name as the very first line
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const name = extractNameFromLines(lines);

    if (!name) {
      return NextResponse.json({ error: 'Could not extract name from resume' }, { status: 422 });
    }

    return NextResponse.json({ name });
  } catch (e) {
    console.error('Resume name extraction error:', e);
    const message = e instanceof Error ? e.message : 'Failed to process resume';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Extract a person's name from the first few lines of resume text.
 * Heuristic: the name is usually the first line, is 2-4 words, and contains
 * only letters/spaces/hyphens (no emails, URLs, phone numbers).
 */
function extractNameFromLines(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    // Skip lines that look like headers, emails, URLs, phone numbers
    if (line.includes('@') || line.includes('http') || line.includes('www.')) continue;
    if (/^\d{3}[\s.-]?\d{3}/.test(line)) continue; // phone number
    if (line.length > 60) continue; // too long for a name

    // A name is typically 2-4 capitalized words
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;

    // Check that most words start with a capital letter
    const capitalizedCount = words.filter(w => /^[A-Z]/.test(w)).length;
    if (capitalizedCount < 2) continue;

    // Check it's mostly letters
    const cleaned = line.replace(/[^a-zA-Z\s.\-']/g, '').trim();
    if (cleaned.length < line.length * 0.7) continue;

    return cleaned;
  }
  return null;
}
