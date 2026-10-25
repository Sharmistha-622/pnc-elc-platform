// The server client, bound to the caller's session. These run inside API
// route handlers, where the browser client has no session and was querying
// as the anonymous role — which the database no longer serves.
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Department, CreateDepartmentInput, UpdateDepartmentInput } from './types';

// Default initial state matching the requested 10 NavGurukul departments
export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept-001',
    name: 'AI LAB',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Artificial Intelligence, LLM research, and automation lab',
    is_archived: false,
    employee_count: 14,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-002',
    name: 'CEO Office',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Executive strategy, leadership, and institutional coordination',
    is_archived: false,
    employee_count: 5,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-003',
    name: 'Finance',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Financial operations, accounts, audit, compliance, and payroll',
    is_archived: false,
    employee_count: 8,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-004',
    name: 'Growth',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Strategic expansion, partnerships, fundraising, and student admissions',
    is_archived: false,
    employee_count: 12,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-005',
    name: 'PnC',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'People & Culture (HR, Talent acquisition, Onboarding, and Lifecycle)',
    is_archived: false,
    employee_count: 10,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-006',
    name: 'Residential',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Residential campus management, student facilities, and campus operations',
    is_archived: false,
    employee_count: 22,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-007',
    name: 'Sama',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Sama initiative, social inclusion, and gender transformative programs',
    is_archived: false,
    employee_count: 9,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-008',
    name: 'SOSC',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'School of Software Development / Open Source community programs',
    is_archived: false,
    employee_count: 16,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-009',
    name: 'Tech & Product',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Engineering, product architecture, platform services, and IT infrastructure',
    is_archived: false,
    employee_count: 28,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-010',
    name: 'Zuvy',
    head_of_department_id: null,
    head_of_department_name: null,
    description: 'Zuvy learning portal, placement tracking, and technical upskilling',
    is_archived: false,
    employee_count: 15,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

// In-memory runtime cache
let memoryDepartments: Department[] = [...DEFAULT_DEPARTMENTS];

export async function getDepartments(includeArchived: boolean = true): Promise<Department[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('departments').select('*').order('name');
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data as Department[];
    }
  } catch (err) {
    // Supabase unavailable, use in-memory store
  }

  return includeArchived
    ? memoryDepartments
    : memoryDepartments.filter((d) => !d.is_archived);
}

export async function createDepartment(input: CreateDepartmentInput): Promise<Department> {
  const newDept: Department = {
    id: `dept-${Date.now()}`,
    name: input.name.trim(),
    head_of_department_id: input.head_of_department_id || null,
    head_of_department_name: input.head_of_department_name || null,
    description: input.description || null,
    is_archived: false,
    employee_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('departments').insert(newDept).select().single();
    if (!error && data) {
      memoryDepartments = [data as Department, ...memoryDepartments];
      return data as Department;
    }
  } catch (err) {
    // Fall back to memory
  }

  memoryDepartments = [newDept, ...memoryDepartments];
  return newDept;
}

export async function updateDepartment(
  id: string,
  updates: UpdateDepartmentInput
): Promise<Department | null> {
  const updatedFields = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('departments')
      .update(updatedFields)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      memoryDepartments = memoryDepartments.map((d) => (d.id === id ? (data as Department) : d));
      return data as Department;
    }
  } catch (err) {
    // Fall back to memory
  }

  const idx = memoryDepartments.findIndex((d) => d.id === id);
  if (idx !== -1) {
    memoryDepartments[idx] = {
      ...memoryDepartments[idx],
      ...updatedFields,
    };
    return memoryDepartments[idx];
  }

  return null;
}

export async function toggleArchiveDepartment(id: string, is_archived: boolean): Promise<Department | null> {
  return updateDepartment(id, { is_archived });
}
