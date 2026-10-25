// The server client, bound to the caller's session. These run inside API
// route handlers, where the browser client has no session and was querying
// as the anonymous role — which the database no longer serves.
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  EmploymentType,
  CreateEmploymentTypeInput,
  UpdateEmploymentTypeInput,
  formatEmploymentTypeName,
  KNOWN_TYPE_MAPPINGS,
} from './types';

export const DEFAULT_EMPLOYMENT_TYPES: EmploymentType[] = [
  {
    id: 'empt-001',
    code: 'fte',
    name: 'Full-Time Employee (FTE)',
    description: 'Permanent salaried employee on organization payroll',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-002',
    code: 'ftc',
    name: 'Full-Time Consultant (FTC)',
    description: 'Fixed-term contract professional or consultant',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-003',
    code: 'intern',
    name: 'Intern',
    description: 'Student or trainee on structured internship stipend',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-004',
    code: 'contractor',
    name: 'Independent Contractor',
    description: 'External vendor or independent service contractor',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-005',
    code: 'apprentice_tech',
    name: 'Apprentice (Tech)',
    description: 'Technical apprentice undergoing residential software training',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-006',
    code: 'apprentice_nontech',
    name: 'Apprentice (Non-Tech)',
    description: 'Operations / Non-technical apprentice in experiential learning',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-007',
    code: 'part_time',
    name: 'Part-Time Consultant',
    description: 'Hourly or fractional time consultant',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'empt-008',
    code: 'fellow',
    name: 'NavGurukul Fellow',
    description: 'Community or teaching fellow in residential campus programs',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

let memoryEmploymentTypes: EmploymentType[] = DEFAULT_EMPLOYMENT_TYPES.map((t) => ({
  ...t,
  name: formatEmploymentTypeName(t.name),
  status: 'active',
}));

function normalizeRecord(item: any): EmploymentType {
  const rawKey = (item.code || item.name || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const known = KNOWN_TYPE_MAPPINGS[rawKey];

  const formattedName = known ? known.name : formatEmploymentTypeName(item.name || item.code || '');
  const description = item.description || (known ? known.description : null);
  const status = item.status === 'archived' ? 'archived' : 'active';
  const code = item.code || rawKey || formattedName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  return {
    id: item.id || `empt-${code}`,
    code,
    name: formattedName,
    description,
    status,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at,
  };
}

export async function getEmploymentTypes(includeArchived: boolean = true): Promise<EmploymentType[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('employee_types').select('*').order('name');
    if (!includeArchived) {
      query = query.or('status.eq.active,status.is.null');
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const normalizedList = data.map(normalizeRecord);

      // Ensure part_time and fellow are present if not in DB yet
      const existingCodes = new Set(normalizedList.map((t) => t.code.toLowerCase()));
      for (const defType of DEFAULT_EMPLOYMENT_TYPES) {
        if (!existingCodes.has(defType.code.toLowerCase())) {
          normalizedList.push(normalizeRecord(defType));
        }
      }

      return includeArchived
        ? normalizedList
        : normalizedList.filter((t) => t.status === 'active');
    }
  } catch (err) {
    // Fall back to memory
  }

  return (includeArchived
    ? memoryEmploymentTypes
    : memoryEmploymentTypes.filter((t) => t.status === 'active')
  ).map(normalizeRecord);
}

export async function createEmploymentType(input: CreateEmploymentTypeInput): Promise<EmploymentType> {
  const formattedName = formatEmploymentTypeName(input.name);
  const rawCode = input.code || formattedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const newType: EmploymentType = {
    id: `empt-${Date.now()}`,
    code: rawCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: formattedName,
    description: input.description?.trim() || null,
    status: input.status === 'archived' ? 'archived' : 'active',
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('employee_types').insert(newType).select().single();
    if (!error && data) {
      const inserted = normalizeRecord(data);
      memoryEmploymentTypes = [inserted, ...memoryEmploymentTypes];
      return inserted;
    }
  } catch (err) {
    // Fall back to memory
  }

  memoryEmploymentTypes = [newType, ...memoryEmploymentTypes];
  return newType;
}

export async function updateEmploymentType(
  id: string,
  updates: UpdateEmploymentTypeInput
): Promise<EmploymentType | null> {
  const updatedFields: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.name) {
    updatedFields.name = formatEmploymentTypeName(updates.name);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('employee_types')
      .update(updatedFields)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      const updated = normalizeRecord(data);
      memoryEmploymentTypes = memoryEmploymentTypes.map((t) => (t.id === id ? updated : t));
      return updated;
    }
  } catch (err) {
    // Fall back to memory
  }

  const idx = memoryEmploymentTypes.findIndex((t) => t.id === id);
  if (idx !== -1) {
    memoryEmploymentTypes[idx] = normalizeRecord({
      ...memoryEmploymentTypes[idx],
      ...updatedFields,
    });
    return memoryEmploymentTypes[idx];
  }

  return null;
}

export async function makeAllEmploymentTypesActive(): Promise<void> {
  memoryEmploymentTypes = memoryEmploymentTypes.map((t) => ({
    ...t,
    status: 'active',
  }));

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('employee_types').update({ status: 'active' }).neq('status', 'active');
  } catch (err) {
    // ignore
  }
}
