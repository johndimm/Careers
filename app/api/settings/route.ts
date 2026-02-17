import { NextResponse } from 'next/server';
import { getAvailableProviders } from '@/lib/llm/registry';

export async function GET() {
  return NextResponse.json({
    available: getAvailableProviders(),
  });
}
