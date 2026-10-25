import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/rbac/guard';
import {
  getEmploymentTypes,
  createEmploymentType,
  updateEmploymentType,
  makeAllEmploymentTypesActive,
} from '@/lib/employment-types/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') !== 'false';
    const types = await getEmploymentTypes(includeArchived);
    return NextResponse.json({ success: true, data: types });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch employment types' },
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

    if (body.action === 'make_all_active') {
      await makeAllEmploymentTypesActive();
      const allTypes = await getEmploymentTypes(true);
      return NextResponse.json({ success: true, data: allTypes });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Classification title is required' },
        { status: 400 }
      );
    }

    const newType = await createEmploymentType({
      code: body.code ? body.code.trim() : undefined,
      name: body.name.trim(),
      description: body.description || null,
      status: body.status || 'active',
    });

    return NextResponse.json({ success: true, data: newType }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create employment type' },
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
        { success: false, error: 'Employment type ID is required' },
        { status: 400 }
      );
    }

    const updated = await updateEmploymentType(id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update employment type' },
      { status: 500 }
    );
  }
}
