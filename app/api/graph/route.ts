import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import crypto from 'crypto';

function generateId(): number {
  return crypto.randomBytes(4).readUInt32BE() % 2147483647; // positive 32-bit integer
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { persons, companies, name } = body;

    if (!persons || !companies) {
      return NextResponse.json({ error: 'persons and companies are required' }, { status: 400 });
    }

    const id = generateId();
    const data = { persons, companies };
    await query(
      'INSERT INTO saved_graphs (id, name, data, persons, companies) VALUES ($1, $2, $3, $4, $5)',
      [id, name || `Graph ${id}`, JSON.stringify(data), JSON.stringify(persons), JSON.stringify(companies)],
    );

    return NextResponse.json({ id });
  } catch (e) {
    console.error('POST /api/graph error:', e);
    return NextResponse.json({ error: 'Failed to save graph' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const row = await queryOne<{ persons: unknown; companies: unknown; name: string | null }>(
      'SELECT persons, companies, name FROM saved_graphs WHERE id = $1',
      [id],
    );

    if (!row) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    return NextResponse.json({ persons: row.persons, companies: row.companies, name: row.name });
  } catch (e) {
    console.error('GET /api/graph error:', e);
    return NextResponse.json({ error: 'Failed to load graph' }, { status: 500 });
  }
}
