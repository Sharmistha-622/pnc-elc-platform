// The server client, bound to the caller's session. These run inside API
// route handlers, where the browser client has no session and was querying
// as the anonymous role — which the database no longer serves.
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Campus, CreateCampusInput, UpdateCampusInput } from './types';

export const DEFAULT_CAMPUSES: Campus[] = [
  { id: 'camp-001', name: 'Bangalore', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-002', name: 'Dantewada', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-003', name: 'Dharamshala', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-004', name: 'Jashpur', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-005', name: 'Kishanganj', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-006', name: 'Pune', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-007', name: 'Raigarh', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'camp-008', name: 'Igatpuri', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
];

let memoryCampuses: Campus[] = [...DEFAULT_CAMPUSES];

export async function getCampuses(includeClosed: boolean = true): Promise<Campus[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('ng_campuses').select('*').order('name');
    if (!includeClosed) {
      query = query.eq('status', 'active');
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data as Campus[];
    }
  } catch (err) {
    // Fall back to memory
  }

  return includeClosed
    ? memoryCampuses
    : memoryCampuses.filter((c) => c.status === 'active');
}

export async function createCampus(input: CreateCampusInput): Promise<Campus> {
  const newCampus: Campus = {
    id: `camp-${Date.now()}`,
    name: input.name.trim(),
    status: input.status || 'active',
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('ng_campuses').insert(newCampus).select().single();
    if (!error && data) {
      memoryCampuses = [data as Campus, ...memoryCampuses];
      return data as Campus;
    }
  } catch (err) {
    // Fall back to memory
  }

  memoryCampuses = [newCampus, ...memoryCampuses];
  return newCampus;
}

export async function updateCampus(id: string, updates: UpdateCampusInput): Promise<Campus | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('ng_campuses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      memoryCampuses = memoryCampuses.map((c) => (c.id === id ? (data as Campus) : c));
      return data as Campus;
    }
  } catch (err) {
    // Fall back to memory
  }

  const idx = memoryCampuses.findIndex((c) => c.id === id);
  if (idx !== -1) {
    memoryCampuses[idx] = {
      ...memoryCampuses[idx],
      ...updates,
    };
    return memoryCampuses[idx];
  }

  return null;
}
