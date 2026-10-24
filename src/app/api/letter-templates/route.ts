import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/rbac/guard';
import { getLetterTemplates, createLetterTemplate } from '@/lib/letter-templates/service';

export async function GET(req: NextRequest) {
  // `middleware.ts` gates this prefix on `letters` as well. Checked here too,
  // so the handler does not depend on a route table elsewhere staying right,
  // and so the original role is checked alongside the effective one.
  const allowed = await guard('letters');
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.error }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as any;
    const employee_type = searchParams.get('employee_type') || undefined;
    const letter_type = searchParams.get('letter_type') || undefined;

    const templates = await getLetterTemplates({
      status: status || 'all',
      employee_type,
      letter_type,
    });

    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const allowed = await guard('letters');
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.error }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.name || !body.letter_type || !body.employee_type_name || (!body.content && !body.blocks_json)) {
      return NextResponse.json(
        { success: false, error: 'Name, letter type, employee type, and content or blocks are required' },
        { status: 400 }
      );
    }
    const template = await createLetterTemplate(body);
    return NextResponse.json({ success: true, data: template });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
