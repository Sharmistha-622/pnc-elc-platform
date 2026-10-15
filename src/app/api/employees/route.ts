import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, email, team, status, employee_type, manager_id, teams(name), employee_types(name)')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const formatted = (data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      email: e.email ?? null,
      team: e.teams?.name || e.team || null,
      status: e.status || 'active',
      employeeType: e.employee_types?.name || e.employee_type || 'FTE',
      managerId: e.manager_id ?? null,
    }))

    return NextResponse.json({ success: true, data: formatted })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
