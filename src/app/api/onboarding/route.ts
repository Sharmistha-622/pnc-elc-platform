import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOnboardingRecords,
  getAllFullOnboardingData,
  createOnboardingRecord,
} from '@/lib/onboarding/service';
import { OFFER_ROLES } from '@/lib/onboarding/access';
import { redactRecordSalary, redactSalary } from '@/lib/onboarding/redact';
import { guard, maySeeSalary } from '@/lib/rbac/guard';

export async function GET(req: NextRequest) {
  try {
    const access = await guard('onboarding');
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });
    // The whole pipeline, every candidate's CTC with it — unless the role may
    // not read salary, in which case the figures are stripped here.
    const salary = maySeeSalary(access.caller);

    const { searchParams } = new URL(req.url);
    const details = searchParams.get('details');
    if (details === 'full') {
      const fullRecords = await getAllFullOnboardingData();
      return NextResponse.json({ success: true, data: salary ? fullRecords : fullRecords.map(redactSalary) });
    }
    const records = await getAllOnboardingRecords();
    return NextResponse.json({ success: true, data: salary ? records : records.map(redactRecordSalary) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // A new candidate is created with their CTC, so this is salary work.
    const access = await guard(OFFER_ROLES);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

    const { custom_letters: customLetters, ...payload } = await req.json();
    const created = await createOnboardingRecord(payload, customLetters);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
