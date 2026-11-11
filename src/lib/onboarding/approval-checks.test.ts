import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { evaluateOnboardingApprovalChecks } from './approval-checks';
import type { FullOnboardingData } from './types';

const RECORD_ID = '11111111-1111-4111-8111-111111111111';

function makeValidDossier(): FullOnboardingData {
  return {
    record: {
      id: RECORD_ID,
      candidate_name: 'Asha Example',
      personal_email: 'asha@example.org',
      designation: 'Associate',
      joining_date: '2026-12-01',
      status: 'submitted',
      progress_percentage: 100,
      is_alumni: false,
      invitation_token: 'tok-example',
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
    },
    personalDetails: {
      onboarding_id: RECORD_ID,
      full_name: 'Asha Example',
      personal_email: 'asha@example.org',
      permanent_address: '10 Example Road, Pune',
      is_alumni: false,
    },
    employmentDetails: {
      onboarding_id: RECORD_ID,
      designation: 'Associate',
      joining_date: '2026-12-01',
      is_alumni: false,
      candidate_confirmed: true,
      correction_requested: false,
    },
    documents: [
      {
        id: 'doc-1',
        onboarding_id: RECORD_ID,
        document_type: 'PAN Card',
        file_name: 'pan.pdf',
        status: 'verified',
        is_required: true,
      },
      {
        id: 'doc-2',
        onboarding_id: RECORD_ID,
        document_type: 'Previous Relieving Letter',
        file_name: '',
        status: 'pending',
        is_required: false,
      },
    ],
    policies: [
      {
        id: 'pol-1',
        onboarding_id: RECORD_ID,
        policy_type: 'code_of_conduct',
        title: 'Code of Conduct',
        description: 'Conduct policy',
        content: 'Text',
        status: 'completed',
      },
    ],
    generatedDocuments: [
      {
        id: 'gen-1',
        onboarding_id: RECORD_ID,
        document_type: 'offer_letter',
        document_name: 'Offer Letter',
        status: 'signed',
        created_at: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'gen-2',
        onboarding_id: RECORD_ID,
        document_type: 'appointment_letter',
        document_name: 'Appointment Letter',
        status: 'signed',
        created_at: '2026-11-01T00:00:00.000Z',
      },
    ],
    activityLogs: [],
    provisioning: null,
    salaryStructure: null,
  };
}

const mockState = vi.hoisted(() => ({
  dossier: null as FullOnboardingData | null,
  updatedStatus: null as string | null,
}));

vi.mock('@/lib/onboarding/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/onboarding/service')>();
  return {
    ...actual,
    getOnboardingById: vi.fn(async () => mockState.dossier),
    updateOnboardingStatus: vi.fn(async (_id: string, status: string) => {
      if (!mockState.dossier) return null;
      const readiness = evaluateOnboardingApprovalChecks(mockState.dossier);
      if (status === 'approved' && !readiness.canApprove) {
        throw new Error(
          `Cannot approve onboarding dossier — failing checks: ${readiness.failingChecks.join(', ')}`
        );
      }
      mockState.updatedStatus = status;
      return {
        ...mockState.dossier,
        record: { ...mockState.dossier.record, status: status as FullOnboardingData['record']['status'] },
      };
    }),
  };
});

vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () => ({
    ok: true,
    caller: { userId: 'u-pnc', email: 'pnc@example.org', role: 'pnc_ops' },
  })),
  maySeeSalary: () => false,
}));

import { PATCH } from '@/app/api/onboarding/[id]/route';

describe('evaluateOnboardingApprovalChecks', () => {
  it('passes when all six checks pass', () => {
    const result = evaluateOnboardingApprovalChecks(makeValidDossier());
    expect(result.canApprove).toBe(true);
    expect(result.failingChecks).toEqual([]);
  });

  it('lists every failing check by label when items are incomplete', () => {
    const dossier = makeValidDossier();
    dossier.personalDetails = undefined;
    dossier.employmentDetails = {
      onboarding_id: RECORD_ID,
      designation: 'Associate',
      joining_date: '2026-12-01',
      is_alumni: false,
      candidate_confirmed: false,
      correction_requested: true,
    };
    dossier.documents[0].status = 'uploaded';
    dossier.policies[0].status = 'not_started';
    dossier.generatedDocuments[0].status = 'generated';
    dossier.generatedDocuments[1].status = 'generated';

    const result = evaluateOnboardingApprovalChecks(dossier);
    expect(result.canApprove).toBe(false);
    expect(result.failingChecks).toEqual([
      'Personal & Contact Dossier',
      'Employment Terms',
      'Document Dossier',
      'Pre-Joining Policies',
      'Offer Letter',
      'Appointment Letter',
    ]);
  });
});

describe('PATCH /api/onboarding/[id] approval gate', () => {
  beforeEach(() => {
    mockState.dossier = makeValidDossier();
    mockState.updatedStatus = null;
  });

  it('refuses approval while any check fails and names the failing checks', async () => {
    mockState.dossier!.documents[0].status = 'uploaded';
    mockState.dossier!.generatedDocuments[1].status = 'generated';

    const req = new NextRequest(`http://localhost/api/onboarding/${RECORD_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'update_status', status: 'approved' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: RECORD_ID }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Document Dossier');
    expect(json.error).toContain('Appointment Letter');
    expect(mockState.updatedStatus).toBeNull();
  });

  it('accepts approval once all checks pass', async () => {
    const req = new NextRequest(`http://localhost/api/onboarding/${RECORD_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'update_status', status: 'approved' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: RECORD_ID }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockState.updatedStatus).toBe('approved');
  });
});
