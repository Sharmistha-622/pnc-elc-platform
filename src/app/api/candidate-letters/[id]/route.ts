import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/rbac/guard';
import { getCandidateLetterById } from '@/lib/letter-templates/service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // `middleware.ts` gates this prefix on `letters` as well. Checked here too,
  // so the handler does not depend on a route table elsewhere staying right,
  // and so the original role is checked alongside the effective one.
  const allowed = await guard('letters');
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.error }, { status: 403 });
  }

  try {
    const { id } = await params;
    const letter = await getCandidateLetterById(id);
    if (!letter) {
      return NextResponse.json({ success: false, error: 'Letter not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: letter });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
