import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/rbac/guard';
import {
  getLocations,
  createLocation,
  updateLocation,
} from '@/lib/locations/service';
import { LocationType } from '@/lib/locations/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeClosed = searchParams.get('includeClosed') !== 'false';
    const type = searchParams.get('type') as LocationType | undefined;
    const locations = await getLocations({ includeClosed, type: type || undefined });
    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch locations' },
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
        { success: false, error: 'Location name is required' },
        { status: 400 }
      );
    }

    const newLocation = await createLocation({
      name: body.name.trim(),
      type: body.type || 'Campus',
      status: body.status || 'active',
    });

    return NextResponse.json({ success: true, data: newLocation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create location' },
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
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const updated = await updateLocation(id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update location' },
      { status: 500 }
    );
  }
}
