import { NextResponse } from 'next/server';
import { getPlyMasters } from '@/lib/firebase/services';

export async function GET() {
  try {
    const data = await getPlyMasters(true); // get all ply masters
    return NextResponse.json({ data });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
