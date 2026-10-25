// The server client, bound to the caller's session. These run inside API
// route handlers, where the browser client has no session and was querying
// as the anonymous role — which the database no longer serves.
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Location, LocationType, CreateLocationInput, UpdateLocationInput } from './types';

export const DEFAULT_LOCATIONS: Location[] = [
  // Residential Campuses
  {
    id: 'loc-001',
    name: 'Bangalore',
    type: 'Campus',
    address: 'NavGurukul Bangalore Campus, Electronic City Phase 1, Bengaluru, Karnataka 560100',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-002',
    name: 'Dantewada',
    type: 'Campus',
    address: 'NavGurukul Residential Campus, Education City, Jawanga, Geedam, Dantewada, Chhattisgarh 494441',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-003',
    name: 'Dharamshala',
    type: 'Campus',
    address: 'NavGurukul Dharamshala Campus, Vill. Sarah, Tehsil Dharamshala, Kangra, Himachal Pradesh 176215',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-004',
    name: 'Jashpur',
    type: 'Campus',
    address: 'NavGurukul Campus, Sankalp Bhawan, Jashpur Nagar, Chhattisgarh 496331',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-005',
    name: 'Kishanganj',
    type: 'Campus',
    address: 'NavGurukul Kishanganj Campus, Halim Chowk, Kishanganj, Bihar 855107',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-006',
    name: 'Pune',
    type: 'Campus',
    address: 'NavGurukul Pune Campus, Hinjewadi Phase 2, Pune, Maharashtra 411057',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-007',
    name: 'Raigarh',
    type: 'Campus',
    address: 'NavGurukul Raigarh Center, Near Collectorate, Raigarh, Chhattisgarh 496001',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-008',
    name: 'Igatpuri',
    type: 'Campus',
    address: 'NavGurukul Igatpuri Campus, Old Agra Road, Igatpuri, Nashik, Maharashtra 422403',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  // Day Centers
  {
    id: 'loc-009',
    name: 'Navigo Pune',
    type: 'Day Center',
    address: 'Navigo Day Center Pune, Maharashtra',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-010',
    name: 'Navigo Igatpuri',
    type: 'Day Center',
    address: 'Navigo Day Center Igatpuri, Nashik, Maharashtra',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

let memoryLocations: Location[] = [...DEFAULT_LOCATIONS];

export async function getLocations(options: { includeClosed?: boolean; type?: LocationType } = {}): Promise<Location[]> {
  const { includeClosed = true, type } = options;
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('ng_locations').select('*').order('name');
    if (!includeClosed) {
      query = query.eq('status', 'active');
    }
    if (type) {
      query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data as Location[];
    }
  } catch (err) {
    // Fall back to memory
  }

  let list = memoryLocations;
  if (!includeClosed) {
    list = list.filter((l) => l.status === 'active');
  }
  if (type) {
    list = list.filter((l) => l.type.toLowerCase() === type.toLowerCase());
  }
  return list;
}

export async function createLocation(input: CreateLocationInput): Promise<Location> {
  const newLocation: Location = {
    id: `loc-${Date.now()}`,
    name: input.name.trim(),
    type: input.type || 'Campus',
    address: input.address?.trim() || null,
    status: input.status || 'active',
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('ng_locations').insert(newLocation).select().single();
    if (!error && data) {
      memoryLocations = [data as Location, ...memoryLocations];
      return data as Location;
    }
  } catch (err) {
    // Fall back to memory
  }

  memoryLocations = [newLocation, ...memoryLocations];
  return newLocation;
}

export async function updateLocation(id: string, updates: UpdateLocationInput): Promise<Location | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('ng_locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      memoryLocations = memoryLocations.map((l) => (l.id === id ? (data as Location) : l));
      return data as Location;
    }
  } catch (err) {
    // Fall back to memory
  }

  const idx = memoryLocations.findIndex((l) => l.id === id);
  if (idx !== -1) {
    memoryLocations[idx] = {
      ...memoryLocations[idx],
      ...updates,
    };
    return memoryLocations[idx];
  }

  return null;
}
