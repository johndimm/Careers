import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let pool: Pool | null = null;
let schemaInitialized = false;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/careers',
    });
  }
  return pool;
}

async function initSchema(): Promise<void> {
  if (schemaInitialized) return;

  const p = getPool();
  const schema = readFileSync(join(process.cwd(), 'lib', 'schema.sql'), 'utf-8');
  await p.query(schema);

  schemaInitialized = true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params?: unknown[]): Promise<{ rows: any[] }> {
  await initSchema();
  const p = getPool();
  return p.query(text, params);
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await query(text, params);
  return (result.rows[0] as T) || null;
}

export async function queryMany<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await query(text, params);
  return result.rows as T[];
}
