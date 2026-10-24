'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/rbac/guard'
import {
  type AuthorizedSignatory,
  type CreateSignatoryInput,
  type UpdateSignatoryInput,
  DEFAULT_SIGNATORIES,
} from './types'

/**
 * Who may change the signatories.
 *
 * Reading them is part of drafting letters (`letters`). Changing them is not:
 * the default signatory's name and signature go out on every offer, so the
 * list is P&C's to maintain. Fin Admin drafts letters but does not decide who
 * signs them.
 */
const SIGNATORY_EDITORS = ['super_admin', 'pnc_admin'] as const

function isTableMissingError(error: any): boolean {
  if (!error) return false
  const msg = error.message || ''
  return msg.includes('Could not find the table') || error.code === '42P01'
}

export async function getSignatories(): Promise<AuthorizedSignatory[]> {
  const allowed = await guard('letters')
  if (!allowed.ok) return []

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('authorized_signatories')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      if (isTableMissingError(error)) {
        console.warn('authorized_signatories table not yet created in Supabase; using default signatories.')
        return DEFAULT_SIGNATORIES
      }
      console.error('Error fetching authorized signatories:', error.message)
      return DEFAULT_SIGNATORIES
    }

    if (!data || data.length === 0) {
      return DEFAULT_SIGNATORIES
    }

    return data
  } catch (err: any) {
    console.error('Unexpected error fetching signatories:', err?.message || err)
    return DEFAULT_SIGNATORIES
  }
}

export async function createSignatory(
  input: CreateSignatoryInput
): Promise<{ success: boolean; data?: AuthorizedSignatory; error?: string }> {
  const allowed = await guard(SIGNATORY_EDITORS)
  if (!allowed.ok) return { success: false, error: allowed.error }

  try {
    const supabase = await createServerSupabaseClient()

    // If marked default, unset existing default first
    if (input.is_default) {
      await supabase
        .from('authorized_signatories')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('authorized_signatories')
      .insert({
        name: input.name.trim(),
        designation: input.designation.trim(),
        email: input.email ? input.email.trim() : null,
        signature_url: input.signature_url || null,
        is_default: input.is_default ?? false,
        is_active: input.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      if (isTableMissingError(error)) {
        return {
          success: true,
          data: {
            id: `temp-${Date.now()}`,
            name: input.name.trim(),
            designation: input.designation.trim(),
            email: input.email ? input.email.trim() : null,
            signature_url: input.signature_url || null,
            is_default: input.is_default ?? false,
            is_active: input.is_active ?? true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/manage/signatories')
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create signatory' }
  }
}

export async function updateSignatory(
  id: string,
  input: UpdateSignatoryInput
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard(SIGNATORY_EDITORS)
  if (!allowed.ok) return { success: false, error: allowed.error }

  try {
    const supabase = await createServerSupabaseClient()

    if (input.is_default) {
      await supabase
        .from('authorized_signatories')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (input.name !== undefined) updatePayload.name = input.name.trim()
    if (input.designation !== undefined) updatePayload.designation = input.designation.trim()
    if (input.email !== undefined) updatePayload.email = input.email ? input.email.trim() : null
    if (input.signature_url !== undefined) updatePayload.signature_url = input.signature_url
    if (input.is_default !== undefined) updatePayload.is_default = input.is_default
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active

    const { error } = await supabase
      .from('authorized_signatories')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      if (isTableMissingError(error)) {
        return { success: true }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/manage/signatories')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update signatory' }
  }
}

export async function deleteSignatory(id: string): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard(SIGNATORY_EDITORS)
  if (!allowed.ok) return { success: false, error: allowed.error }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('authorized_signatories').delete().eq('id', id)

    if (error) {
      if (isTableMissingError(error)) {
        return { success: true }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/manage/signatories')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete signatory' }
  }
}

export async function setDefaultSignatory(id: string): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard(SIGNATORY_EDITORS)
  if (!allowed.ok) return { success: false, error: allowed.error }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Unset all defaults
    await supabase.from('authorized_signatories').update({ is_default: false }).neq('id', id)

    // 2. Set this one as default and ensure active
    const { error } = await supabase
      .from('authorized_signatories')
      .update({ is_default: true, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      if (isTableMissingError(error)) {
        return { success: true }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/manage/signatories')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to set default signatory' }
  }
}

export async function toggleSignatoryActive(
  id: string,
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard(SIGNATORY_EDITORS)
  if (!allowed.ok) return { success: false, error: allowed.error }

  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('authorized_signatories')
      .update({
        is_active,
        // If deactivating, it cannot be default
        ...(is_active === false ? { is_default: false } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      if (isTableMissingError(error)) {
        return { success: true }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/manage/signatories')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle signatory status' }
  }
}
