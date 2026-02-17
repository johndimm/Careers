import { NextRequest, NextResponse } from 'next/server';
import { findAlternatePersonPhoto } from '@/lib/images';

export async function POST(req: NextRequest) {
  const { name, exclude } = await req.json();

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const excludeList: string[] = Array.isArray(exclude) ? exclude : [];
  const photoUrl = await findAlternatePersonPhoto(name, excludeList);

  return NextResponse.json({ photoUrl });
}
