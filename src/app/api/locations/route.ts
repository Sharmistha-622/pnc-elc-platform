import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/rbac/guard';
import { getLocations, getStates, createLocation, updateLocation, LocationError } from '@/lib/locations/service';
import { parseLocationFields } from '@/lib/locations/input';
import { LOCATION_TYPES, type LocationType } from '@/lib/locations/types';

function failure(error: unknown, fallback: string) {
  const status = error instanceof LocationError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ success: false, error: message || fallback }, { status });
}

// Reading is open to staff (the database's "staff read" policy decides);
// `?include=states` adds the list of states for the pickers.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeClosed = searchParams.get('includeClosed') !== 'false';
    const typeParam = searchParams.get('type');
    const type = LOCATION_TYPES.includes(typeParam as LocationType) ? (typeParam as LocationType) : undefined;
    const [locations, states] = await Promise.all([
      getLocations({ includeClosed, type }),
      searchParams.get('include') === 'states' ? getStates() : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ success: true, data: locations, ...(states ? { states } : {}) });
  } catch (error) {
    return failure(error, 'Failed to fetch locations');
  }
}

export async function POST(req: NextRequest) {
  // Reading the list is open to staff; changing master data is not.
  const access = await guard('masterData');
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Send the location as JSON.' }, { status: 400 });
    }
    const parsed = parseLocationFields(body, { requireName: true });
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const created = await createLocation({ ...parsed.value, name: parsed.value.name! });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return failure(error, 'Failed to create location');
  }
}

export async function PATCH(req: NextRequest) {
  const access = await guard('masterData');
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 403 });

  try {
    const body = await req.json().catch(() => null);
    const id = body && typeof body.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ success: false, error: 'Location ID is required' }, { status: 400 });
    }
    const parsed = parseLocationFields(body, { requireName: false });
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    if (Object.keys(parsed.value).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to change.' }, { status: 400 });
    }
    const updated = await updateLocation(id, parsed.value);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return failure(error, 'Failed to update location');
  }
}
