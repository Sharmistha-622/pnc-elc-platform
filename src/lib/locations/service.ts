// The server client, bound to the caller's session. These run inside API
// route handlers, so the database's own policies apply: every staff role
// reads, and only data management (Super Admin, PnC Admin, Platform Admin)
// writes.
//
// Errors are thrown, never papered over. This module used to keep an
// in-memory copy and fall back to it whenever the database refused a write,
// and since it also sent a made-up `loc-…` id into a uuid column, every new
// location was "created" in memory only and gone on the next restart.
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  Location,
  LocationType,
  CreateLocationInput,
  UpdateLocationInput,
  IndianState,
} from './types';

export class LocationError extends Error {
  constructor(message: string, readonly status: number = 500) {
    super(message);
  }
}

function friendly(error: { code?: string; message: string }): LocationError {
  if (error.code === '23505') return new LocationError('A location with that name already exists.', 409);
  if (error.code === '23503') return new LocationError('That state is not in the list of states.', 400);
  if (error.code === '42501') return new LocationError('You do not have access to do that.', 403);
  return new LocationError(error.message);
}

export async function getLocations(options: { includeClosed?: boolean; type?: LocationType } = {}): Promise<Location[]> {
  const { includeClosed = true, type } = options;
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('ng_locations').select('*').order('name');
  if (!includeClosed) query = query.eq('status', 'active');
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw friendly(error);
  return (data ?? []) as Location[];
}

export async function getStates(): Promise<IndianState[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('indian_states').select('code, name, kind, aliases').order('name');
  if (error) throw friendly(error);
  return (data ?? []) as IndianState[];
}

export async function createLocation(input: CreateLocationInput): Promise<Location> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ng_locations')
    .insert({
      name: input.name.trim(),
      type: input.type || 'Campus',
      address: input.address?.trim() || null,
      state_code: input.state_code || null,
      status: input.status || 'active',
    })
    .select()
    .single();
  if (error) throw friendly(error);
  return data as Location;
}

export async function updateLocation(id: string, updates: UpdateLocationInput): Promise<Location> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('ng_locations').update(updates).eq('id', id).select();
  if (error) throw friendly(error);
  // A row the policies hide or refuse updates nothing, without an error.
  if (!data?.length) throw new LocationError('Location not found, or you cannot change it.', 404);
  return data[0] as Location;
}
