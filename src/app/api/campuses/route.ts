import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/rbac/guard';
import {
  getCampuses,
  createCampus,
  updateCampus,
} from '@/lib/campuses/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeClosed = searchParams.get('includeClosed') !== 'false';
    const campuses = await getCampuses(includeClosed);
    return NextResponse.json({ success: true, data: campuses });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch campuses' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Reading the list is open to staff; changing master data is not.
  const access = await guard('masterData');
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Campus name is required' },
        { status: 400 }
      );
    }

    const newCampus = await createCampus({
      name: body.name.trim(),
      status: body.status || 'active',
    });

    return NextResponse.json({ success: true, data: newCampus }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create campus' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const access = await guard('masterData');
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Campus ID is required' },
        { status: 400 }
      );
    }

    const updated = await updateCampus(id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update campus' },
      { status: 500 }
    );
  }
}
