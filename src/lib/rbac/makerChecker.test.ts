import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertDifferentPeople,
  checkDifferentPeople,
  samePerson,
} from './makerChecker';

const mockOnboardingDb = vi.fn();
const mockServerSupabase = vi.fn();
const mockPrivacyEditor = vi.fn();

vi.mock('@/lib/onboarding/db', () => ({
  onboardingDb: () => mockOnboardingDb(),
  assertOk: (err: { message: string } | null, ctx: string) => {
    if (err) throw new Error(`${ctx}: ${err.message}`);
  },
  isUuid: () => true,
  mapRecord: (r: Record<string, unknown>) => r,
  mapDocument: (r: Record<string, unknown>) => r,
  mapGeneratedDocument: (r: Record<string, unknown>) => r,
  mapProvisioning: (r: Record<string, unknown> | null) => r,
  RECORD_SELECT: '*',
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => mockServerSupabase(),
}));

vi.mock('@/lib/dpdp/access', () => ({
  privacyEditor: () => mockPrivacyEditor(),
  retentionModeRefusal: async () => null,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit/events', () => ({
  auditEvent: vi.fn(),
  auditOnboarding: {
    statusChanged: vi.fn(),
  },
  auditLetters: {
    signed: vi.fn(),
  },
}));

describe('makerChecker helper', () => {
  it('matches identical identifiers regardless of case or surrounding whitespace', () => {
    expect(samePerson('Maker@Example.org ', ' maker@example.org')).toBe(true);
    expect(samePerson('emp-1', 'emp-2')).toBe(false);
    expect(samePerson(null, 'emp-1')).toBe(false);
    expect(samePerson('emp-1', undefined)).toBe(false);
    expect(samePerson('', '')).toBe(false);
    expect(samePerson('P&C Team', 'P&C Team')).toBe(false);
  });

  it('refuses when maker and checker are the same person and allows when different', () => {
    expect(checkDifferentPeople('pnc.one@example.org', 'PNC.ONE@example.org')).toEqual({
      ok: false,
      error: 'The person who recorded or issued this cannot also approve it.',
    });
    expect(checkDifferentPeople('pnc.one@example.org', 'pnc.two@example.org')).toEqual({
      ok: true,
    });
    expect(() =>
      assertDifferentPeople('pnc.one@example.org', 'pnc.one@example.org', 'Custom error.'),
    ).toThrow('Custom error.');
  });
});

describe('maker ≠ checker across workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses review cycle acceptance when the PnC closer recorded the manager decision', async () => {
    const { closeCycle } = await import('@/lib/reviews/service');

    let decisionReviewedBy: string | null = null;
    const db = {
      from: (table: string) => {
        if (table === 'review_cycles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'cycle-1',
                    kind: 'appraisal',
                    stage: 'decision_recorded',
                    employee_id: 'emp-subject',
                    manager_id: 'emp-maker',
                    appraisal_id: 'app-1',
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'review_decisions') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'dec-1',
                    cycle_id: 'cycle-1',
                    decision: 'meet_expectations',
                    decided_by: 'emp-maker',
                  },
                  error: null,
                }),
              }),
            }),
            update: (patch: { pnc_reviewed_by?: string }) => {
              decisionReviewedBy = patch.pnc_reviewed_by ?? null;
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === 'employees') {
          return {
            select: () => ({
              eq: (_col: string, id: string) => ({
                maybeSingle: async () => ({
                  data:
                    id === 'emp-maker'
                      ? { id: 'emp-maker', name: 'Maker Person', email: 'maker@example.org' }
                      : { id: 'emp-subject', name: 'Subject Person', email: 'subject@example.org' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'review_participants') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'appraisals') {
          return {
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'review_events') {
          return {
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const baseCtx = {
      db,
      now: new Date('2026-11-12T10:00:00Z'),
      appUrl: 'http://localhost:3000',
      mail: { send: vi.fn(), invite: vi.fn() },
    };

    const bySameId = await closeCycle(
      { ...baseCtx, actor: 'other@example.org' },
      'cycle-1',
      { outcome: 'accepted', note: 'Approved', checkerEmployeeId: 'emp-maker' },
    );
    expect(bySameId).toEqual({
      ok: false,
      error: 'The person who recorded the review decision cannot also accept it.',
    });

    const bySameEmail = await closeCycle(
      { ...baseCtx, actor: 'MAKER@example.org' },
      'cycle-1',
      { outcome: 'accepted', note: 'Approved', checkerEmployeeId: 'emp-other' },
    );
    expect(bySameEmail).toEqual({
      ok: false,
      error: 'The person who recorded the review decision cannot also accept it.',
    });
    expect(decisionReviewedBy).toBeNull();

    // A different PnC reviewer may accept and close the cycle.
    const byDifferentActor = await closeCycle(
      { ...baseCtx, actor: 'checker@example.org' },
      'cycle-1',
      { outcome: 'accepted', note: 'Approved by second reviewer', checkerEmployeeId: 'emp-checker' },
    );
    expect(byDifferentActor).toEqual({ ok: true, value: undefined });
    expect(decisionReviewedBy).toBe('checker@example.org');
  });

  it('refuses onboarding final approval when the approver issued the offer or candidate letters', async () => {
    const { updateOnboardingStatus } = await import('@/lib/onboarding/service');

    let updatedStatus: string | null = null;
    const emptyChildChain = {
      in: () => ({
        order: async () => ({ data: [], error: null }),
        then: (resolve: (val: { data: never[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      }),
    };

    mockOnboardingDb.mockReturnValue({
      from: (table: string) => {
        if (table === 'onboarding_records') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    candidate_name: 'Asha Rao',
                    personal_email: 'asha@example.org',
                    designation: 'Engineer',
                    status: 'submitted',
                    created_by: 'issuer@example.org',
                  },
                  error: null,
                }),
              }),
            }),
            update: (patch: { status?: string }) => {
              if (patch.status) updatedStatus = patch.status;
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === 'candidate_letters') {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ created_by: 'letter-author@example.org' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'onboarding_activity_log') {
          return {
            select: () => emptyChildChain,
            insert: async () => ({ error: null }),
          };
        }
        return {
          select: () => emptyChildChain,
        };
      },
    });

    await expect(
      updateOnboardingStatus(
        '11111111-1111-4111-8111-111111111111',
        'approved',
        'Looks good',
        'ISSUER@example.org',
      ),
    ).rejects.toThrow('The person who issued the offer or letters cannot also approve the onboarding.');

    await expect(
      updateOnboardingStatus(
        '11111111-1111-4111-8111-111111111111',
        'approved',
        'Looks good',
        'letter-author@example.org',
      ),
    ).rejects.toThrow('The person who issued the offer or letters cannot also approve the onboarding.');

    expect(updatedStatus).toBeNull();

    await updateOnboardingStatus(
      '11111111-1111-4111-8111-111111111111',
      'approved',
      'Checked by second PnC member',
      'approver@example.org',
    );
    expect(updatedStatus).toBe('approved');
  });

  it('refuses DPDP notice publication when the publisher drafted the notice', async () => {
    const { publishNotice } = await import('@/lib/dpdp/settings/actions');

    const noticeId = '22222222-2222-4222-8222-222222222222';
    let publishedBy: string | null = null;
    mockServerSupabase.mockResolvedValue({
      from: (table: string) => {
        if (table === 'dpdp_notices') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: noticeId,
                    notice_type: 'breach_board',
                    language: 'en',
                    status: 'draft',
                    version: 2,
                    created_by: 'drafter@example.org',
                    sections: {
                      body:
                        '{{description}} {{location}} {{consequences}} {{mitigation}} {{cause}} {{intimations}} {{contact}}',
                    },
                  },
                  error: null,
                }),
              }),
            }),
            update: (patch: { published_by?: string }) => {
              publishedBy = patch.published_by ?? null;
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === 'dpdp_settings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'default',
                    privacy_contact_name: 'Privacy Lead',
                    privacy_contact_email: 'privacy@example.org',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'dpdp_settings_log') {
          return {
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
    });

    mockPrivacyEditor.mockResolvedValueOnce({
      ok: true,
      caller: { userId: 'u-drafter', email: 'Drafter@example.org', role: 'super_admin' },
    });

    const sameActorResult = await publishNotice({
      id: noticeId,
      reason: 'Publishing my own draft notice',
    });
    expect(sameActorResult).toEqual({
      success: false,
      error: 'The person who drafted the notice cannot also publish it.',
    });
    expect(publishedBy).toBeNull();

    mockPrivacyEditor.mockResolvedValueOnce({
      ok: true,
      caller: { userId: 'u-publisher', email: 'publisher@example.org', role: 'super_admin' },
    });

    const differentActorResult = await publishNotice({
      id: noticeId,
      reason: 'Reviewed and approved for publication',
    });
    expect(differentActorResult).toEqual({ success: true });
    expect(publishedBy).toBe('publisher@example.org');
  });
});
