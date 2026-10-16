import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOnboardingRecords,
  getAllFullOnboardingData,
  createOnboardingRecord,
} from '@/lib/onboarding/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const details = searchParams.get('details');
    if (details === 'full') {
      const fullRecords = await getAllFullOnboardingData();
      return NextResponse.json({ success: true, data: fullRecords });
    }
    const records = await getAllOnboardingRecords();
    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { custom_letters: customLetters, ...payload } = await req.json();
    const created = await createOnboardingRecord(payload, customLetters);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
