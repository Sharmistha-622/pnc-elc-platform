import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { UserRole } from '@/lib/role-constants';
import { ACTION_ROLES } from '@/lib/onboarding/access';
import { buildTeamFilterOptions, canWithdrawRecord } from '@/lib/onboarding/candidate-list';
import { DEFAULT_DEPARTMENTS } from '@/lib/departments/service';

const state = vi.hoisted(() => ({
  role: 'pnc_admin' as UserRole,
  withdrawnCalls: [] as Array<{ id: string; reason: string; actor: string }>,
}));

vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async (allowed: readonly UserRole[] | string) => {
    const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
    if (!allowedRoles.includes(state.role)) {
      return { ok: false, status: 403, error: 'You do not have access to this action.' };
    }
    return {
      ok: true,
      caller: {
        userId: '00000000-0000-4000-8000-000000000001',
        email: 'pnc@example.org',
        role: state.role,
      },
    };
  }),
  maySeeSalary: vi.fn(() => true),
}));

vi.mock('@/lib/onboarding/service', () => ({
  getOnboardingById: vi.fn(),
  sendOnboardingInvitation: vi.fn(),
  verifyOrRejectDocument: vi.fn(),
  updateOnboardingStatus: vi.fn(),
  provisionOfficialAccount: vi.fn(),
  updateOrientationChecklist: vi.fn(),
  updateProbationMilestone: vi.fn(),
  updateProvisioningDetails: vi.fn(),
  regenerateCandidateDocuments: vi.fn(),
  retrySealDocument: vi.fn(),
  withdrawJoiner: vi.fn(async (id: string, reason: string, actor: string) => {
    state.withdrawnCalls.push({ id, reason, actor });
    return {
      record: {
        id,
        candidate_name: 'Asha Example',
        personal_email: 'asha@example.org',
        joiner_status: 'withdrawn',
      },
      personalDetails: null,
      employmentDetails: null,
      documents: [],
      policies: [],
      generatedDocuments: [],
      activityLogs: [],
      provisioning: null,
      probationMilestones: [],
      salaryStructure: null,
    };
  }),
  purgeWithdrawnDocuments: vi.fn(),
}));

import { PATCH } from './route';

const VALID_ID = '11111111-2222-4333-8444-555555555555';

function patchWithdraw(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest(`http://localhost/api/onboarding/${VALID_ID}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: VALID_ID }) }
  );
}

beforeEach(() => {
  state.role = 'pnc_admin';
  state.withdrawnCalls = [];
});

describe('PATCH /api/onboarding/[id] withdraw & team filter (#155)', () => {
  it('refuses withdraw when the caller role lacks the withdraw gate', async () => {
    for (const deniedRole of ['fin_admin', 'exec_view', 'manager', 'employee'] as UserRole[]) {
      expect(ACTION_ROLES.withdraw).not.toContain(deniedRole);
      state.role = deniedRole;

      const res = await patchWithdraw({
        action: 'withdraw',
        reason: 'Candidate declined the offer.',
      });

      expect(res.status).toBe(403);
      expect(state.withdrawnCalls).toHaveLength(0);
    }
  });

  it('refuses withdraw when the reason is missing or blank', async () => {
    const missingRes = await patchWithdraw({ action: 'withdraw' });
    expect(missingRes.status).toBe(400);
    expect((await missingRes.json()).error).toMatch(/reason is required/i);

    const blankRes = await patchWithdraw({ action: 'withdraw', reason: '   ' });
    expect(blankRes.status).toBe(400);
    expect((await blankRes.json()).error).toMatch(/reason is required/i);

    expect(state.withdrawnCalls).toHaveLength(0);
  });

  it('withdraws the candidate when reason and gate are satisfied', async () => {
    state.role = 'pnc_ops';
    const res = await patchWithdraw({
      action: 'withdraw',
      reason: '  Candidate accepted another role  ',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(state.withdrawnCalls).toEqual([
      {
        id: VALID_ID,
        reason: 'Candidate accepted another role',
        actor: 'pnc@example.org',
      },
    ]);
  });

  it('canWithdrawRecord allows pre-confirmed statuses and blocks withdrawn/confirmed', () => {
    expect(canWithdrawRecord('offer_pending')).toBe(true);
    expect(canWithdrawRecord('docs_submitted')).toBe(true);
    expect(canWithdrawRecord('withdrawn')).toBe(false);
    expect(canWithdrawRecord('confirmed')).toBe(false);
  });

  it('lists active departments in the candidate team filter and excludes archived ones', () => {
    const options = buildTeamFilterOptions([
      ...DEFAULT_DEPARTMENTS,
      { name: 'Archived Team', is_archived: true },
    ]);

    expect(options).toEqual(DEFAULT_DEPARTMENTS.map((d) => d.name));
    expect(options).not.toContain('Archived Team');

    const candidatePage = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(dashboard)/onboarding/candidate/page.tsx'),
      'utf8'
    );
    expect(candidatePage).toContain('/api/departments?includeArchived=false');
    expect(candidatePage).toContain('buildTeamFilterOptions');
  });
});

