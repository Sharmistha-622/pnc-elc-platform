'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { auditOffboarding, auditAccess, auditLetters } from '@/lib/audit/events';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/sendEmail';
import { platformConfigRefusal } from '@/lib/settings/access';
import { guard, guardResource, maySeeSalary } from '@/lib/rbac/guard';
import { FEATURE_ACCESS } from '@/lib/role-constants';
import { getCurrentEmployee } from '@/lib/forms/currentEmployee';
import {
  ExitType,
  OffboardingStatus,
  OffboardingCase,
  OffboardingChecklistItem,
  OffboardingAssetItem,
  OffboardingNDCDepartment,
  OffboardingFnF,
  OffboardingActivityLog,
  ExitDocument,
  OffboardingSettings,
  DEFAULT_OFFBOARDING_SETTINGS,
  FullOffboardingData,
  InitiateOffboardingInput,
  ResignationRequest,
  ResignationSource,
  ReviewDecision,
  EmployeeRetentionResponse,
  ResignationRequestStatus,
  SubmitResignationInput,
} from './types';
import { assetIntegrationService } from '@/lib/integrations/assets';
import { attendanceIntegrationService } from '@/lib/integrations/attendance';
import { leaveIntegrationService } from '@/lib/integrations/leave';
import { getEmployees } from '@/lib/employees/getEmployees';


// ============================================================================
// DEFAULT CONFIGURATION & RECOVERY SETTINGS
// ============================================================================

let MEMORY_SETTINGS = { ...DEFAULT_OFFBOARDING_SETTINGS };

// ============================================================================
// REALISTIC SEED DATA COVERING ALL 7 REQUIRED SCENARIOS
// ============================================================================

const MEMORY_OFFBOARDING_STORE: Map<string, FullOffboardingData> = new Map();

function initSeedScenarios() {
  if (MEMORY_OFFBOARDING_STORE.size > 0) return;

  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  // Helper date generators
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return formatYMD(d);
  };

  const daysAhead = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return formatYMD(d);
  };

  // --------------------------------------------------------------------------
  // SCENARIO A: Normal Resignation (in notice period, approaching LWD)
  // --------------------------------------------------------------------------
  const caseAId = 'off-case-001-vikram-patel';
  const caseA: OffboardingCase = {
    id: caseAId,
    employee_id: 'emp-vikram-patel',
    employee_name: 'Vikram Patel',
    employee_email: 'vikram.patel@navgurukul.org',
    employee_designation: 'Lead Pedagogical Designer',
    employee_department: 'Academia',
    employee_type: 'Full-Time Employee',
    manager_name: 'Ananya Sen',
    exit_type: 'resignation',
    initiated_date: daysAgo(20),
    initiated_by: 'Vikram Patel (Self-Resignation)',
    proposed_lwd: daysAhead(10),
    actual_lwd: null,
    notice_period_days: 30,
    notice_period_waived: false,
    reason: 'Pursuing higher education / Ph.D. opportunity abroad',
    reason_details: 'Admitted to education technology doctoral fellowship commencing next semester.',
    status: 'notice_period',
    immediate_relieving: false,
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  };

  const checklistA: OffboardingChecklistItem[] = [
    {
      id: 'chk-a-1',
      offboarding_id: caseAId,
      title: 'Curriculum & Pedagogy Handover Documentation',
      description: 'Transfer Google Drive teaching repos, curriculum lesson plans, and sprint milestones.',
      category: 'knowledge_transfer',
      owner_role: 'employee',
      assigned_to_name: 'Vikram Patel',
      status: 'in_progress',
      is_mandatory: true,
      due_date: daysAhead(5),
      notes: '70% curriculum guides uploaded to shared team folder.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'chk-a-2',
      offboarding_id: caseAId,
      title: 'Primary Handover Review & Acceptance',
      description: 'Manager validates transition repository and team onboarding.',
      category: 'knowledge_transfer',
      owner_role: 'manager',
      assigned_to_name: 'Ananya Sen',
      status: 'pending',
      is_mandatory: true,
      due_date: daysAhead(7),
      notes: 'Scheduled sprint transition review for upcoming Tuesday.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'chk-a-3',
      offboarding_id: caseAId,
      title: 'Company Laptop & Peripheral Return',
      description: 'Hand over MacBook Air M2, charger, and display adapter to IT operations.',
      category: 'asset_return',
      owner_role: 'it_admin',
      assigned_to_name: 'IT Helpdesk Team',
      status: 'pending',
      is_mandatory: true,
      due_date: daysAhead(9),
      notes: 'IT desk booked return inspection slot on LWD-1.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'chk-a-4',
      offboarding_id: caseAId,
      title: 'Confidential Exit Interview Questionnaire',
      description: 'Complete exit survey covering workplace culture and feedback.',
      category: 'exit_interview',
      owner_role: 'employee',
      assigned_to_name: 'Vikram Patel',
      status: 'completed',
      is_mandatory: true,
      due_date: daysAhead(3),
      completed_at: daysAgo(2),
      completed_by: 'Vikram Patel',
      notes: 'Questionnaire completed and submitted via employee portal.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'chk-a-5',
      offboarding_id: caseAId,
      title: 'Expense Claims & Outstanding Travel Settlement',
      description: 'Submit pending campus travel expense receipts for final reimbursement.',
      category: 'finance',
      owner_role: 'finance',
      assigned_to_name: 'Finance Desk',
      status: 'in_progress',
      is_mandatory: true,
      due_date: daysAhead(6),
      notes: 'Campus visit claims under verification.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
  ];

  const assetsA: OffboardingAssetItem[] = [
    {
      id: 'asset-a-1',
      offboarding_id: caseAId,
      asset_name: 'MacBook Air M2 (13-inch, 16GB RAM)',
      asset_tag: 'NG-LAP-2026-042',
      asset_type: 'laptop',
      assigned_date: '2024-03-15',
      return_status: 'pending_return',
      condition: 'good',
      recovery_amount: 0,
      clearance_notes: 'Physical verification scheduled at Bangalore campus.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'asset-a-2',
      offboarding_id: caseAId,
      asset_name: 'Campus Access Smartcard & ID Badge',
      asset_tag: 'NG-ID-00412',
      asset_type: 'id_card',
      assigned_date: '2024-03-15',
      return_status: 'pending_return',
      clearance_notes: 'To be deposited at security reception on LWD.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
  ];

  const ndcA: OffboardingNDCDepartment[] = [
    {
      id: 'ndc-a-1',
      offboarding_id: caseAId,
      department: 'manager',
      department_label: 'Reporting Manager (Academia)',
      status: 'under_review',
      remarks: 'Handover underway; awaiting completion of curriculum doc transfer.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'ndc-a-2',
      offboarding_id: caseAId,
      department: 'it_admin',
      department_label: 'IT & Asset Operations',
      status: 'pending',
      remarks: 'Pending physical laptop return inspection.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'ndc-a-3',
      offboarding_id: caseAId,
      department: 'finance',
      department_label: 'Finance & Accounts',
      status: 'under_review',
      remarks: 'Expense claims submitted, pending approval.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
    {
      id: 'ndc-a-4',
      offboarding_id: caseAId,
      department: 'pnc',
      department_label: 'People & Culture',
      status: 'pending',
      remarks: 'Awaiting departmental sign-offs prior to issuing NDC.',
      created_at: caseA.created_at,
      updated_at: caseA.updated_at,
    },
  ];

  const fnfA: OffboardingFnF = {
    id: 'fnf-a-1',
    offboarding_id: caseAId,
    status: 'awaiting_clearance',
    payable_days: 20,
    leave_encashment_days: 4.5,
    gratuity_eligible: false,
    asset_recovery_amount: 0,
    other_deductions: 0,
    net_payable_estimate: '₹62,400 (Pending finalized days)',
    remarks: 'Awaiting LWD confirmation and all departmental clearances.',
    blocked_reasons: ['Department clearances in progress', 'Asset return pending'],
    created_at: caseA.created_at,
    updated_at: caseA.updated_at,
  };

  const logsA: OffboardingActivityLog[] = [
    {
      id: 'log-a-1',
      offboarding_id: caseAId,
      actor_name: 'Vikram Patel',
      actor_role: 'employee',
      action: 'Resignation Initiated',
      description: 'Employee submitted formal resignation with 30-day notice period.',
      created_at: caseA.created_at,
    },
    {
      id: 'log-a-2',
      offboarding_id: caseAId,
      actor_name: 'P&C Operations',
      actor_role: 'pnc',
      action: 'Notice Period Confirmed',
      description: `Formal acknowledgment sent with proposed LWD as ${caseA.proposed_lwd}.`,
      created_at: new Date(Date.now() - 86400000 * 19).toISOString(),
    },
    {
      id: 'log-a-3',
      offboarding_id: caseAId,
      actor_name: 'Vikram Patel',
      actor_role: 'employee',
      action: 'Exit Survey Completed',
      description: 'Employee completed confidential exit questionnaire.',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  MEMORY_OFFBOARDING_STORE.set(caseAId, {
    caseRecord: caseA,
    checklist: checklistA,
    assets: assetsA,
    ndc: ndcA,
    fnf: fnfA,
    activityLogs: logsA,
    documents: [],
  });

  // --------------------------------------------------------------------------
  // SCENARIO B: Exit with Pending Asset & Damage Exception (Blocked Clearance)
  // --------------------------------------------------------------------------
  const caseBId = 'off-case-002-siddharth-sharma';
  const caseB: OffboardingCase = {
    id: caseBId,
    employee_id: 'emp-siddharth-sharma',
    employee_name: 'Siddharth Sharma',
    employee_email: 'siddharth.s@navgurukul.org',
    employee_designation: 'Senior Frontend Developer',
    employee_department: 'Technology',
    employee_type: 'Full-Time Employee',
    manager_name: 'Karan Mehra',
    exit_type: 'resignation',
    initiated_date: daysAgo(28),
    initiated_by: 'Siddharth Sharma',
    proposed_lwd: daysAhead(2),
    actual_lwd: null,
    notice_period_days: 30,
    notice_period_waived: false,
    reason: 'Better career growth opportunity',
    status: 'clearance_in_progress',
    immediate_relieving: false,
    exception_notes: 'MacBook display cracked during remote work transit. Repair assessment underway.',
    created_at: new Date(Date.now() - 86400000 * 28).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  };

  const checklistB: OffboardingChecklistItem[] = [
    {
      id: 'chk-b-1',
      offboarding_id: caseBId,
      title: 'GitHub & AWS Repository Access Revocation Scheduled',
      category: 'admin',
      owner_role: 'it_admin',
      assigned_to_name: 'IT Admin Desk',
      status: 'in_progress',
      is_mandatory: true,
      due_date: daysAhead(2),
      notes: 'Scheduled for 6:00 PM on LWD.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
    {
      id: 'chk-b-2',
      offboarding_id: caseBId,
      title: 'Asset Return & Physical Damage Assessment',
      category: 'asset_return',
      owner_role: 'it_admin',
      assigned_to_name: 'IT Asset Lead',
      status: 'blocked',
      is_mandatory: true,
      due_date: daysAgo(1),
      notes: 'Laptop screen damaged. Awaiting policy exception or deduction confirmation.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
    {
      id: 'chk-b-3',
      offboarding_id: caseBId,
      title: 'Frontend Code Handover & Documentation',
      category: 'knowledge_transfer',
      owner_role: 'manager',
      assigned_to_name: 'Karan Mehra',
      status: 'completed',
      is_mandatory: true,
      completed_at: daysAgo(3),
      completed_by: 'Karan Mehra',
      notes: 'All PRs reviewed and merged. Handover completed smoothly.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
  ];

  const assetsB: OffboardingAssetItem[] = [
    {
      id: 'asset-b-1',
      offboarding_id: caseBId,
      asset_name: 'MacBook Pro 14" M3 (512GB SSD)',
      asset_tag: 'NG-LAP-2025-019',
      asset_type: 'laptop',
      assigned_date: '2025-01-10',
      return_status: 'under_recovery',
      condition: 'damaged',
      recovery_amount: 8500,
      clearance_notes: 'Display screen cracked. Authorized repair quote is ₹8,500. Under P&C recovery review.',
      verified_by: 'IT Admin Desk',
      verified_at: daysAgo(2),
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
  ];

  const ndcB: OffboardingNDCDepartment[] = [
    {
      id: 'ndc-b-1',
      offboarding_id: caseBId,
      department: 'manager',
      department_label: 'Reporting Manager (Technology)',
      status: 'cleared',
      cleared_by: 'Karan Mehra',
      cleared_at: daysAgo(3),
      remarks: 'KT handover fully completed and validated.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
    {
      id: 'ndc-b-2',
      offboarding_id: caseBId,
      department: 'it_admin',
      department_label: 'IT & Asset Operations',
      status: 'blocked',
      remarks: 'Asset clearance blocked due to laptop damage recovery pending.',
      blocker_reason: 'Asset damaged: ₹8,500 recovery pending settlement approval.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
    {
      id: 'ndc-b-3',
      offboarding_id: caseBId,
      department: 'finance',
      department_label: 'Finance & Accounts',
      status: 'pending',
      remarks: 'Awaiting IT clearance and recovery amount sign-off.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
    {
      id: 'ndc-b-4',
      offboarding_id: caseBId,
      department: 'pnc',
      department_label: 'People & Culture',
      status: 'blocked',
      remarks: 'Asset recovery decision required before final clearance.',
      created_at: caseB.created_at,
      updated_at: caseB.updated_at,
    },
  ];

  const fnfB: OffboardingFnF = {
    id: 'fnf-b-1',
    offboarding_id: caseBId,
    status: 'blocked',
    payable_days: 28,
    leave_encashment_days: 6.0,
    gratuity_eligible: false,
    asset_recovery_amount: 8500,
    other_deductions: 0,
    net_payable_estimate: '₹84,200 (Subject to ₹8,500 asset deduction)',
    remarks: 'Held pending employee confirmation of asset recovery amount.',
    blocked_reasons: ['IT Asset clearance blocked', 'Recovery amount confirmation needed'],
    created_at: caseB.created_at,
    updated_at: caseB.updated_at,
  };

  const logsB: OffboardingActivityLog[] = [
    {
      id: 'log-b-1',
      offboarding_id: caseBId,
      actor_name: 'IT Asset Desk',
      actor_role: 'it_admin',
      action: 'Asset Return Exception Flagged',
      description: 'MacBook Pro returned with damaged display screen. Assessed repair cost ₹8,500.',
      created_at: daysAgo(2),
    },
  ];

  MEMORY_OFFBOARDING_STORE.set(caseBId, {
    caseRecord: caseB,
    checklist: checklistB,
    assets: assetsB,
    ndc: ndcB,
    fnf: fnfB,
    activityLogs: logsB,
    documents: [],
  });

  // --------------------------------------------------------------------------
  // SCENARIO C: Exit with Pending Knowledge Transfer (KT Handover Blocker)
  // --------------------------------------------------------------------------
  const caseCId = 'off-case-003-priya-shukla';
  const caseC: OffboardingCase = {
    id: caseCId,
    employee_id: 'emp-priya-shukla',
    employee_name: 'Priya Shukla',
    employee_email: 'priya.shukla@navgurukul.org',
    employee_designation: 'Operations Coordinator',
    employee_department: 'Operations',
    employee_type: 'Full-Time Consultant',
    manager_name: 'Manish Rawat',
    exit_type: 'resignation',
    initiated_date: daysAgo(25),
    initiated_by: 'Priya Shukla',
    proposed_lwd: daysAhead(5),
    actual_lwd: null,
    notice_period_days: 30,
    notice_period_waived: false,
    reason: 'Relocating to hometown for family commitments',
    status: 'notice_period',
    immediate_relieving: false,
    created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  };

  const checklistC: OffboardingChecklistItem[] = [
    {
      id: 'chk-c-1',
      offboarding_id: caseCId,
      title: 'Dharamshala Campus Operations SOP & Vendor Directory',
      category: 'knowledge_transfer',
      owner_role: 'employee',
      assigned_to_name: 'Priya Shukla',
      status: 'blocked',
      is_mandatory: true,
      due_date: daysAgo(2),
      notes: 'Vendor contracts and lease agreement handover overdue by 2 days.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
    {
      id: 'chk-c-2',
      offboarding_id: caseCId,
      title: 'Handover Acceptance by Successor Coordinator',
      category: 'knowledge_transfer',
      owner_role: 'manager',
      assigned_to_name: 'Manish Rawat',
      status: 'pending',
      is_mandatory: true,
      due_date: daysAhead(3),
      notes: 'Awaiting complete vendor audit before signing off.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
    {
      id: 'chk-c-3',
      offboarding_id: caseCId,
      title: 'Office Keys & Petty Cash Reconciliation',
      category: 'finance',
      owner_role: 'finance',
      assigned_to_name: 'Finance Desk',
      status: 'completed',
      is_mandatory: true,
      completed_at: daysAgo(1),
      completed_by: 'Finance Operations',
      notes: 'Petty cash balance ₹4,200 deposited and verified.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
  ];

  const ndcC: OffboardingNDCDepartment[] = [
    {
      id: 'ndc-c-1',
      offboarding_id: caseCId,
      department: 'manager',
      department_label: 'Reporting Manager (Operations)',
      status: 'blocked',
      blocker_reason: 'Knowledge transfer incomplete: Campus vendor directory and active agreements pending.',
      remarks: 'Overdue handover documents must be transferred before approval.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
    {
      id: 'ndc-c-2',
      offboarding_id: caseCId,
      department: 'it_admin',
      department_label: 'IT & Asset Operations',
      status: 'cleared',
      cleared_by: 'IT Admin Desk',
      cleared_at: daysAgo(3),
      remarks: 'Asset returned in pristine condition.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
    {
      id: 'ndc-c-3',
      offboarding_id: caseCId,
      department: 'finance',
      department_label: 'Finance & Accounts',
      status: 'cleared',
      cleared_by: 'Finance Desk',
      cleared_at: daysAgo(1),
      remarks: 'Petty cash reconciled and settled.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
    {
      id: 'ndc-c-4',
      offboarding_id: caseCId,
      department: 'pnc',
      department_label: 'People & Culture',
      status: 'pending',
      remarks: 'Awaiting Manager KT sign-off.',
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
  ];

  MEMORY_OFFBOARDING_STORE.set(caseCId, {
    caseRecord: caseC,
    checklist: checklistC,
    assets: [
      {
        id: 'asset-c-1',
        offboarding_id: caseCId,
        asset_name: 'Dell Latitude 5420 Laptop',
        asset_tag: 'NG-LAP-2024-008',
        asset_type: 'laptop',
        assigned_date: '2024-06-01',
        return_status: 'cleared',
        condition: 'good',
        verified_by: 'IT Desk',
        verified_at: daysAgo(3),
        created_at: caseC.created_at,
        updated_at: caseC.updated_at,
      },
    ],
    ndc: ndcC,
    fnf: {
      id: 'fnf-c-1',
      offboarding_id: caseCId,
      status: 'awaiting_clearance',
      payable_days: 25,
      leave_encashment_days: 3,
      gratuity_eligible: false,
      asset_recovery_amount: 0,
      other_deductions: 0,
      net_payable_estimate: '₹52,000',
      blocked_reasons: ['Manager KT clearance pending'],
      created_at: caseC.created_at,
      updated_at: caseC.updated_at,
    },
    activityLogs: [
      {
        id: 'log-c-1',
        offboarding_id: caseCId,
        actor_name: 'System Reminder',
        actor_role: 'system',
        action: 'Overdue Task Reminder Sent',
        description: 'Automated reminder dispatched to Priya Shukla for Campus Operations SOP.',
        created_at: daysAgo(1),
      },
    ],
    documents: [],
  });

  // --------------------------------------------------------------------------
  // SCENARIO D: Exit with Pending NDC Sign-Offs (Department Clearances Underway)
  // --------------------------------------------------------------------------
  const caseDId = 'off-case-004-arjun-nair';
  const caseD: OffboardingCase = {
    id: caseDId,
    employee_id: 'emp-arjun-nair',
    employee_name: 'Arjun Nair',
    employee_email: 'arjun.nair@navgurukul.org',
    employee_designation: 'Senior DevOps Engineer',
    employee_department: 'Infrastructure',
    employee_type: 'Full-Time Employee',
    manager_name: 'Rohit Verma',
    exit_type: 'resignation',
    initiated_date: daysAgo(29),
    initiated_by: 'Arjun Nair',
    proposed_lwd: daysAhead(1),
    actual_lwd: null,
    notice_period_days: 30,
    notice_period_waived: false,
    reason: 'Joining multinational technology consulting firm',
    status: 'clearance_in_progress',
    immediate_relieving: false,
    created_at: new Date(Date.now() - 86400000 * 29).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  };

  const ndcD: OffboardingNDCDepartment[] = [
    {
      id: 'ndc-d-1',
      offboarding_id: caseDId,
      department: 'manager',
      department_label: 'Reporting Manager (Infra)',
      status: 'cleared',
      cleared_by: 'Rohit Verma',
      cleared_at: daysAgo(2),
      remarks: 'Kubernetes and CI/CD cluster credentials transferred.',
      created_at: caseD.created_at,
      updated_at: caseD.updated_at,
    },
    {
      id: 'ndc-d-2',
      offboarding_id: caseDId,
      department: 'it_admin',
      department_label: 'IT & Asset Operations',
      status: 'cleared',
      cleared_by: 'IT Helpdesk',
      cleared_at: daysAgo(1),
      remarks: 'ThinkPad T14 and monitor returned in good working order.',
      created_at: caseD.created_at,
      updated_at: caseD.updated_at,
    },
    {
      id: 'ndc-d-3',
      offboarding_id: caseDId,
      department: 'finance',
      department_label: 'Finance & Accounts',
      status: 'under_review',
      remarks: 'Verifying broadband reimbursement claim for August-September.',
      created_at: caseD.created_at,
      updated_at: caseD.updated_at,
    },
    {
      id: 'ndc-d-4',
      offboarding_id: caseDId,
      department: 'pnc',
      department_label: 'People & Culture',
      status: 'pending',
      remarks: 'Final sign-off scheduled for tomorrow upon Finance clearance.',
      created_at: caseD.created_at,
      updated_at: caseD.updated_at,
    },
  ];

  MEMORY_OFFBOARDING_STORE.set(caseDId, {
    caseRecord: caseD,
    checklist: [],
    assets: [],
    ndc: ndcD,
    fnf: {
      id: 'fnf-d-1',
      offboarding_id: caseDId,
      status: 'computation_pending',
      payable_days: 30,
      leave_encashment_days: 8.5,
      gratuity_eligible: false,
      asset_recovery_amount: 0,
      other_deductions: 0,
      net_payable_estimate: '₹1,18,000',
      blocked_reasons: ['Finance department NDC verification pending'],
      created_at: caseD.created_at,
      updated_at: caseD.updated_at,
    },
    activityLogs: [],
    documents: [],
  });

  // --------------------------------------------------------------------------
  // SCENARIO E: F&F Settlement In Progress (All Clearances Complete)
  // --------------------------------------------------------------------------
  const caseEId = 'off-case-005-neha-deshmukh';
  const caseE: OffboardingCase = {
    id: caseEId,
    employee_id: 'emp-neha-deshmukh',
    employee_name: 'Neha Deshmukh',
    employee_email: 'neha.d@navgurukul.org',
    employee_designation: 'Staff Accountant',
    employee_department: 'Finance',
    employee_type: 'Full-Time Employee',
    manager_name: 'Pooja Bhatt',
    exit_type: 'resignation',
    initiated_date: daysAgo(35),
    initiated_by: 'Neha Deshmukh',
    proposed_lwd: daysAgo(5),
    actual_lwd: daysAgo(5),
    notice_period_days: 30,
    notice_period_waived: false,
    reason: 'Higher studies preparation',
    status: 'settlement_pending',
    immediate_relieving: false,
    created_at: new Date(Date.now() - 86400000 * 35).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  };

  const ndcE: OffboardingNDCDepartment[] = [
    {
      id: 'ndc-e-1',
      offboarding_id: caseEId,
      department: 'manager',
      department_label: 'Reporting Manager',
      status: 'cleared',
      cleared_by: 'Pooja Bhatt',
      cleared_at: daysAgo(7),
      remarks: 'All ledger books and GST documentation reconciled.',
      created_at: caseE.created_at,
      updated_at: caseE.updated_at,
    },
    {
      id: 'ndc-e-2',
      offboarding_id: caseEId,
      department: 'it_admin',
      department_label: 'IT & Assets',
      status: 'cleared',
      cleared_by: 'IT Admin',
      cleared_at: daysAgo(6),
      remarks: 'HP EliteBook returned and verified.',
      created_at: caseE.created_at,
      updated_at: caseE.updated_at,
    },
    {
      id: 'ndc-e-3',
      offboarding_id: caseEId,
      department: 'finance',
      department_label: 'Finance & Accounts',
      status: 'cleared',
      cleared_by: 'Finance Lead',
      cleared_at: daysAgo(5),
      remarks: 'No financial dues outstanding.',
      created_at: caseE.created_at,
      updated_at: caseE.updated_at,
    },
    {
      id: 'ndc-e-4',
      offboarding_id: caseEId,
      department: 'pnc',
      department_label: 'People & Culture',
      status: 'cleared',
      cleared_by: 'P&C Operations',
      cleared_at: daysAgo(5),
      remarks: 'All clearance criteria fulfilled.',
      created_at: caseE.created_at,
      updated_at: caseE.updated_at,
    },
  ];

  const fnfE: OffboardingFnF = {
    id: 'fnf-e-1',
    offboarding_id: caseEId,
    status: 'under_review',
    payable_days: 25,
    leave_encashment_days: 5.0,
    gratuity_eligible: false,
    asset_recovery_amount: 0,
    other_deductions: 0,
    net_payable_estimate: '₹58,450',
    remarks: 'Settlement sheet computed; awaiting final finance disbursement approval.',
    blocked_reasons: [],
    created_at: caseE.created_at,
    updated_at: caseE.updated_at,
  };

  MEMORY_OFFBOARDING_STORE.set(caseEId, {
    caseRecord: caseE,
    checklist: [],
    assets: [],
    ndc: ndcE,
    fnf: fnfE,
    activityLogs: [
      {
        id: 'log-e-1',
        offboarding_id: caseEId,
        actor_name: 'P&C Operations',
        actor_role: 'pnc',
        action: 'NDC Certificate Formally Cleared',
        description: 'All 4 departments signed off on No Dues Certificate.',
        created_at: daysAgo(5),
      },
    ],
    documents: [
      {
        id: 'doc-e-ndc',
        offboarding_id: caseEId,
        document_type: 'ndc',
        document_name: 'No Dues Certificate — Neha Deshmukh.pdf',
        status: 'signed',
        generated_at: daysAgo(5),
      },
    ],
  });

  // --------------------------------------------------------------------------
  // SCENARIO F: Immediate Relieving / Special Exception Case (Notice Waived)
  // --------------------------------------------------------------------------
  const caseFId = 'off-case-006-tarun-kapoor';
  const caseF: OffboardingCase = {
    id: caseFId,
    employee_id: 'emp-tarun-kapoor',
    employee_name: 'Tarun Kapoor',
    employee_email: 'tarun.kapoor@navgurukul.org',
    employee_designation: 'Associate Partner — Admissions',
    employee_department: 'Admissions & Partnerships',
    employee_type: 'Full-Time Consultant',
    manager_name: 'Shreya Ghosh',
    exit_type: 'immediate_relieving',
    initiated_date: daysAgo(3),
    initiated_by: 'Leadership Approval (Mutual Separation)',
    proposed_lwd: daysAgo(3),
    actual_lwd: daysAgo(3),
    notice_period_days: 0,
    notice_period_waived: true,
    reason: 'Family medical emergency requiring immediate relocation',
    status: 'settlement_pending',
    immediate_relieving: true,
    exception_notes: 'Notice period of 30 days waived by Executive Director due to compassionate medical grounds.',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  };

  MEMORY_OFFBOARDING_STORE.set(caseFId, {
    caseRecord: caseF,
    checklist: [],
    assets: [
      {
        id: 'asset-f-1',
        offboarding_id: caseFId,
        asset_name: 'Lenovo ThinkPad E14',
        asset_tag: 'NG-LAP-2025-081',
        asset_type: 'laptop',
        assigned_date: '2025-05-10',
        return_status: 'returned',
        condition: 'good',
        verified_by: 'IT Admin',
        verified_at: daysAgo(2),
        created_at: caseF.created_at,
        updated_at: caseF.updated_at,
      },
    ],
    ndc: [
      {
        id: 'ndc-f-1',
        offboarding_id: caseFId,
        department: 'manager',
        department_label: 'Manager (Partnerships)',
        status: 'cleared',
        cleared_by: 'Shreya Ghosh',
        cleared_at: daysAgo(2),
        remarks: 'Emergency handover accepted.',
        created_at: caseF.created_at,
        updated_at: caseF.updated_at,
      },
      {
        id: 'ndc-f-2',
        offboarding_id: caseFId,
        department: 'it_admin',
        department_label: 'IT & Assets',
        status: 'cleared',
        cleared_by: 'IT Admin',
        cleared_at: daysAgo(2),
        remarks: 'Laptop received and accounts deprovisioned.',
        created_at: caseF.created_at,
        updated_at: caseF.updated_at,
      },
      {
        id: 'ndc-f-3',
        offboarding_id: caseFId,
        department: 'finance',
        department_label: 'Finance & Accounts',
        status: 'cleared',
        cleared_by: 'Finance Lead',
        cleared_at: daysAgo(2),
        remarks: 'Notice waiver approved; pro-rated consultancy fee calculated.',
        created_at: caseF.created_at,
        updated_at: caseF.updated_at,
      },
      {
        id: 'ndc-f-4',
        offboarding_id: caseFId,
        department: 'pnc',
        department_label: 'People & Culture',
        status: 'cleared',
        cleared_by: 'P&C Operations',
        cleared_at: daysAgo(1),
        remarks: 'Compassionate waiver sign-off documented.',
        created_at: caseF.created_at,
        updated_at: caseF.updated_at,
      },
    ],
    fnf: {
      id: 'fnf-f-1',
      offboarding_id: caseFId,
      status: 'processing',
      payable_days: 12,
      leave_encashment_days: 0,
      gratuity_eligible: false,
      asset_recovery_amount: 0,
      other_deductions: 0,
      net_payable_estimate: '₹28,800',
      remarks: 'Expedited disbursement in progress via NEFT.',
      blocked_reasons: [],
      created_at: caseF.created_at,
      updated_at: caseF.updated_at,
    },
    activityLogs: [
      {
        id: 'log-f-1',
        offboarding_id: caseFId,
        actor_name: 'P&C Operations',
        actor_role: 'pnc',
        action: 'Immediate Relieving Exception Approved',
        description: 'Notice period waived by leadership for Tarun Kapoor.',
        created_at: daysAgo(3),
      },
    ],
    documents: [],
  });

  // --------------------------------------------------------------------------
  // SCENARIO G: Completed / Closed Exit (Historical, Documents Issued)
  // --------------------------------------------------------------------------
  const caseGId = 'off-case-007-ananya-roy';
  const caseG: OffboardingCase = {
    id: caseGId,
    employee_id: 'emp-ananya-roy',
    employee_name: 'Ananya Roy',
    employee_email: 'ananya.roy@navgurukul.org',
    employee_designation: 'Senior Program Manager',
    employee_department: 'Outreach & Partnerships',
    employee_type: 'Full-Time Employee',
    manager_name: 'Anurag Kundu',
    exit_type: 'resignation',
    initiated_date: daysAgo(60),
    initiated_by: 'Ananya Roy',
    proposed_lwd: daysAgo(30),
    actual_lwd: daysAgo(30),
    notice_period_days: 30,
    notice_period_waived: false,
    reason: 'Career progression / Lead role at international foundation',
    status: 'completed',
    immediate_relieving: false,
    exit_closed_at: daysAgo(25),
    exit_closed_by: 'P&C Operations Lead',
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 25).toISOString(),
  };

  MEMORY_OFFBOARDING_STORE.set(caseGId, {
    caseRecord: caseG,
    checklist: [],
    assets: [
      {
        id: 'asset-g-1',
        offboarding_id: caseGId,
        asset_name: 'MacBook Pro 16" M2 Max',
        asset_tag: 'NG-LAP-2023-001',
        asset_type: 'laptop',
        return_status: 'cleared',
        condition: 'excellent',
        verified_by: 'IT Admin',
        verified_at: daysAgo(30),
        created_at: caseG.created_at,
        updated_at: caseG.updated_at,
      },
    ],
    ndc: [
      {
        id: 'ndc-g-1',
        offboarding_id: caseGId,
        department: 'manager',
        department_label: 'Manager',
        status: 'cleared',
        cleared_by: 'Anurag Kundu',
        cleared_at: daysAgo(31),
        created_at: caseG.created_at,
        updated_at: caseG.updated_at,
      },
      {
        id: 'ndc-g-2',
        offboarding_id: caseGId,
        department: 'it_admin',
        department_label: 'IT & Assets',
        status: 'cleared',
        cleared_by: 'IT Admin',
        cleared_at: daysAgo(30),
        created_at: caseG.created_at,
        updated_at: caseG.updated_at,
      },
      {
        id: 'ndc-g-3',
        offboarding_id: caseGId,
        department: 'finance',
        department_label: 'Finance',
        status: 'cleared',
        cleared_by: 'Finance Lead',
        cleared_at: daysAgo(28),
        created_at: caseG.created_at,
        updated_at: caseG.updated_at,
      },
      {
        id: 'ndc-g-4',
        offboarding_id: caseGId,
        department: 'pnc',
        department_label: 'People & Culture',
        status: 'cleared',
        cleared_by: 'P&C Operations',
        cleared_at: daysAgo(28),
        created_at: caseG.created_at,
        updated_at: caseG.updated_at,
      },
    ],
    fnf: {
      id: 'fnf-g-1',
      offboarding_id: caseGId,
      status: 'processed',
      payable_days: 30,
      leave_encashment_days: 12.0,
      gratuity_eligible: true,
      asset_recovery_amount: 0,
      other_deductions: 0,
      net_payable_estimate: '₹1,64,500',
      payment_reference: 'HDFC-NEFT-20260828-94102',
      payment_date: daysAgo(25),
      processed_by: 'Finance Lead',
      processed_at: daysAgo(25),
      remarks: 'Final settlement released and credited to employee salary account.',
      blocked_reasons: [],
      created_at: caseG.created_at,
      updated_at: caseG.updated_at,
    },
    activityLogs: [
      {
        id: 'log-g-1',
        offboarding_id: caseGId,
        actor_name: 'P&C Operations Lead',
        actor_role: 'pnc',
        action: 'Exit Officially Closed',
        description: 'All formalities completed. Employee marked as officially Exited in registry.',
        created_at: daysAgo(25),
      },
    ],
    documents: [
      {
        id: 'doc-g-ndc',
        offboarding_id: caseGId,
        document_type: 'ndc',
        document_name: 'No Dues Certificate — Ananya Roy.pdf',
        status: 'signed',
        generated_at: daysAgo(28),
      },
      {
        id: 'doc-g-relieving',
        offboarding_id: caseGId,
        document_type: 'relieving_letter',
        document_name: 'Relieving & Experience Letter — Ananya Roy.pdf',
        status: 'delivered',
        generated_at: daysAgo(25),
      },
    ],
  });
}

// Initialise seed data immediately
initSeedScenarios();

// ============================================================================
// AUDIT LOG HELPER
// ============================================================================

async function recordAuditLog(
  tableName: string,
  recordId: string,
  action: 'insert' | 'update' | 'delete',
  changedData: Record<string, any>,
  changedBy: string = 'pnc-user'
) {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('audit_log').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      changed_by: null, // nullable in audit_log schema
      changed_data: {
        ...changedData,
        actor: changedBy,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Audit table may not exist in local mode
  }
}

// ============================================================================
// ACCESS
// ----------------------------------------------------------------------------
// Every export below is a server action: the browser can call it directly,
// with any arguments, whichever page imported it. The `/offboarding` route
// gate does not reach them, so each one checks its caller here.
// ============================================================================

/**
 * The full-and-final settlement as a caller without salary access may see it.
 *
 * F&F is salary data: the net payable, the deductions taken from it and the
 * bank reference of the payment. PnC Ops runs exits and needs the clearance
 * status and blockers, but the matrix gives them `salary: none`. The remarks
 * go too, because they are where the computed figures get written down.
 * `other_deductions` is required by the type, so it is zeroed rather than
 * dropped; the only screen that shows it is the edit form, which this caller
 * cannot save (`updateFnFDetails`).
 */
function withoutSettlementFigures(fnf: OffboardingFnF): OffboardingFnF {
  return {
    ...fnf,
    other_deductions: 0,
    asset_recovery_amount: 0,
    net_payable_estimate: undefined,
    payment_reference: null,
    payment_date: null,
    remarks: null,
  };
}

/** The signed-in user's own employee id, or null. */
async function currentEmployeeId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { employee } = await getCurrentEmployee(supabase);
  return employee?.id ?? null;
}

// ============================================================================
// CORE SERVICE LAYER METHODS
// ============================================================================

/**
 * Fetch all offboarding cases.
 */
/**
 * Audit subject for an offboarding case. Both keys are carried: the employee
 * ID links to their directory record, and the email keeps the trail resolvable
 * after that record is archived at exit.
 */
function auditSubject(c: { employee_id: string; employee_email: string; employee_name: string }) {
  return {
    employee_id: c.employee_id,
    employee_email: c.employee_email,
    employee_name: c.employee_name,
  };
}

export async function getAllOffboardingCases(): Promise<OffboardingCase[]> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return [];

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('offboarding_cases')
      .select('*, employees(name, email, team)')
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        ...row,
        employee_name: row.employees?.name || row.employee_name,
        employee_email: row.employees?.email || row.employee_email,
      }));
    }
  } catch (err) {
    // Fallback to memory (timeout, missing table, or network error)
  }

  return Array.from(MEMORY_OFFBOARDING_STORE.values())
    .map((item) => item.caseRecord)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Fetch a single offboarding case by ID with all related records.
 */
export async function getOffboardingById(id: string): Promise<FullOffboardingData | null> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return null;

  let fullData: FullOffboardingData | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data: caseRow, error: caseErr } = await supabase
      .from('offboarding_cases')
      .select('*, employees(*)')
      .eq('id', id)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timeout);

    if (!caseErr && caseRow) {
      // PnC Ops runs the exit but holds `salary: none`, and the database
      // closes `offboarding_fnf` to them. They still need to see where the
      // settlement stands and what is blocking it, so for them those columns
      // — and no amount — are read with the service-role client, past the
      // `offboarding` guard above.
      const salary = maySeeSalary(allowed.caller);
      const fnfQuery = salary
        ? supabase.from('offboarding_fnf').select('*')
        : (createAdminSupabaseClient() ?? supabase)
            .from('offboarding_fnf')
            .select(
              'id, offboarding_id, status, blocked_reasons, payable_days, leave_encashment_days, gratuity_eligible, processed_at, created_at, updated_at'
            );
      const [chkRes, assetRes, ndcRes, fnfRes, logsRes] = await Promise.all([
        supabase.from('offboarding_checklists').select('*').eq('offboarding_id', id),
        supabase.from('offboarding_asset_clearances').select('*').eq('offboarding_id', id),
        supabase.from('offboarding_ndc').select('*').eq('offboarding_id', id),
        fnfQuery.eq('offboarding_id', id).maybeSingle(),
        supabase.from('offboarding_activity_log').select('*').eq('offboarding_id', id).order('created_at', { ascending: false }),
      ]);

      const caseRecord: OffboardingCase = {
        ...caseRow,
        employee_name: caseRow.employees?.name || caseRow.employee_name,
        employee_email: caseRow.employees?.email || caseRow.employee_email,
      };

      fullData = {
        caseRecord,
        checklist: chkRes.data || [],
        assets: assetRes.data || [],
        ndc: ndcRes.data || [],
        fnf: {
          id: `fnf-${id}`,
          offboarding_id: id,
          status: 'not_started',
          payable_days: 0,
          leave_encashment_days: 0,
          gratuity_eligible: false,
          asset_recovery_amount: 0,
          other_deductions: 0,
          blocked_reasons: [],
          created_at: caseRow.created_at,
          updated_at: caseRow.updated_at,
          ...((fnfRes.data as Partial<OffboardingFnF> | null) ?? {}),
        },
        activityLogs: logsRes.data || [],
        documents: [],
      };
    }
  } catch {
    // Fallback to memory (timeout, missing table, or network error)
  }

  if (!fullData) {
    fullData = MEMORY_OFFBOARDING_STORE.get(id) || null;
  }

  if (fullData) {
    try {
      const [extAssets, extAtt, extLeave] = await Promise.all([
        assetIntegrationService.getEmployeeAssignedAssets(fullData.caseRecord.employee_id),
        attendanceIntegrationService.getEmployeeAttendanceSummary(fullData.caseRecord.employee_id),
        leaveIntegrationService.getEmployeeLeaveSummary(fullData.caseRecord.employee_id),
      ]);
      fullData.externalAssetsSummary = extAssets;
      fullData.externalAttendanceSummary = extAtt;
      fullData.externalLeaveSummary = extLeave;
    } catch (err) {
      console.warn('Could not fetch external integration summary:', err);
    }
  }

  // A copy, not the stored record: the memory store hands back the live
  // object, and redacting that in place would erase the figures for everyone.
  if (fullData && !maySeeSalary(allowed.caller)) {
    return { ...fullData, fnf: withoutSettlementFigures(fullData.fnf) };
  }

  return fullData;
}


/**
 * Initiate an employee exit.
 */
export async function initiateOffboardingCase(
  input: InitiateOffboardingInput
): Promise<{ success: boolean; caseId?: string; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  return openOffboardingCase(input);
}

/**
 * Opens the case. Not exported: the resignation flow calls this once a
 * resignation is accepted, which can follow an employee's own response to a
 * retention offer (`respondToRetention`), and that caller has already been
 * checked by the action that got here.
 */
async function openOffboardingCase(
  input: InitiateOffboardingInput
): Promise<{ success: boolean; caseId?: string; error?: string }> {
  try {
    const caseId = `off-case-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const initialStatus: OffboardingStatus = input.immediate_relieving ? 'settlement_pending' : 'notice_period';
    const noticeDays = input.notice_period_days ?? 30;

    const newCase: OffboardingCase = {
      id: caseId,
      employee_id: input.employee_id,
      employee_name: input.employee_name,
      employee_email: input.employee_email,
      employee_designation: input.employee_designation,
      employee_department: input.employee_department,
      employee_type: input.employee_type,
      manager_name: input.manager_name || 'Assigned Manager',
      exit_type: input.exit_type,
      initiated_date: input.initiated_date || new Date().toISOString().split('T')[0],
      initiated_by: input.initiated_by || 'P&C Operations',
      proposed_lwd: input.proposed_lwd,
      actual_lwd: input.immediate_relieving ? input.proposed_lwd : null,
      notice_period_days: noticeDays,
      notice_period_waived: Boolean(input.notice_period_waived),
      reason: input.reason,
      reason_details: input.reason_details,
      status: initialStatus,
      immediate_relieving: Boolean(input.immediate_relieving),
      exception_notes: input.exception_notes,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Standard initial checklist
    const defaultChecklist: OffboardingChecklistItem[] = [
      {
        id: `chk-${Date.now()}-1`,
        offboarding_id: caseId,
        title: 'Knowledge Handover Documentation & Repository Transfer',
        description: 'Document active project tasks, repositories, drive assets, and runbooks.',
        category: 'knowledge_transfer',
        owner_role: 'employee',
        assigned_to_name: input.employee_name,
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-2`,
        offboarding_id: caseId,
        title: 'Manager Handover Acceptance & Peer Handover',
        description: 'Validate knowledge transfer completion and team reassignments.',
        category: 'knowledge_transfer',
        owner_role: 'manager',
        assigned_to_name: input.manager_name || 'Reporting Manager',
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-3`,
        offboarding_id: caseId,
        title: 'IT Asset & Hardware Return Inspection',
        description: 'Verify and return issued laptop, monitor, chargers, and hardware peripherals.',
        category: 'asset_return',
        owner_role: 'it_admin',
        assigned_to_name: 'IT Operations Desk',
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-4`,
        offboarding_id: caseId,
        title: 'Confidential Exit Interview & Feedback Form',
        description: 'Submit confidential reflections, handover feedback, and survey responses.',
        category: 'exit_interview',
        owner_role: 'employee',
        assigned_to_name: input.employee_name,
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-5`,
        offboarding_id: caseId,
        title: 'Expense Claims & Financial Dues Verification',
        description: 'Verify travel advances, reimbursements, or pending claims.',
        category: 'finance',
        owner_role: 'finance',
        assigned_to_name: 'Finance Desk',
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    // Standard initial departmental NDC
    const defaultNdc: OffboardingNDCDepartment[] = [
      {
        id: `ndc-${Date.now()}-1`,
        offboarding_id: caseId,
        department: 'manager',
        department_label: 'Reporting Manager',
        status: 'pending',
        remarks: 'Handover underway.',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `ndc-${Date.now()}-2`,
        offboarding_id: caseId,
        department: 'it_admin',
        department_label: 'IT & Asset Operations',
        status: 'pending',
        remarks: 'Awaiting hardware return.',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `ndc-${Date.now()}-3`,
        offboarding_id: caseId,
        department: 'finance',
        department_label: 'Finance & Accounts',
        status: 'pending',
        remarks: 'Expense claims check in progress.',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `ndc-${Date.now()}-4`,
        offboarding_id: caseId,
        department: 'pnc',
        department_label: 'People & Culture',
        status: 'pending',
        remarks: 'Awaiting departmental sign-offs.',
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    // Initial F&F Record
    const defaultFnf: OffboardingFnF = {
      id: `fnf-${caseId}`,
      offboarding_id: caseId,
      status: 'awaiting_clearance',
      payable_days: 0,
      leave_encashment_days: 0,
      gratuity_eligible: false,
      asset_recovery_amount: 0,
      other_deductions: 0,
      remarks: 'Computation scheduled upon clearance completion.',
      blocked_reasons: ['Department NDC clearances pending', 'Asset verification pending'],
      created_at: nowIso,
      updated_at: nowIso,
    };

    const initialActivity: OffboardingActivityLog[] = [
      {
        id: `log-${Date.now()}-init`,
        offboarding_id: caseId,
        actor_name: input.initiated_by || 'P&C Operations',
        actor_role: 'pnc',
        action: 'Exit Formally Initiated',
        description: `Exit initiated for ${input.employee_name} (${input.exit_type.replace(/_/g, ' ')}). Proposed LWD: ${input.proposed_lwd}. Notice: ${noticeDays} days.`,
        created_at: nowIso,
      },
    ];

    // Query External Integration APIs to prime clearances and F&F
    let initialAssets: OffboardingAssetItem[] = [
      {
        id: `asset-${Date.now()}-lap`,
        offboarding_id: caseId,
        asset_name: 'Company Assigned Laptop & Charger',
        asset_type: 'laptop',
        return_status: 'pending_return',
        condition: 'good',
        clearance_notes: 'Physical check at campus reception on LWD.',
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    let extAttSummary: any = null;
    let extLeaveSummary: any = null;
    let extAssetsSummary: any = null;

    try {
      const [extAssets, extAtt, extLeave] = await Promise.all([
        assetIntegrationService.getEmployeeAssignedAssets(input.employee_id),
        attendanceIntegrationService.getEmployeeAttendanceSummary(input.employee_id),
        leaveIntegrationService.getEmployeeLeaveSummary(input.employee_id),
      ]);
      extAssetsSummary = extAssets;
      extAttSummary = extAtt;
      extLeaveSummary = extLeave;

      if (extAssets.assets.length > 0) {
        initialAssets = extAssets.assets.map((a) => ({
          id: `ast-${caseId}-${a.asset_id}`,
          offboarding_id: caseId,
          asset_name: a.asset_name,
          asset_tag: a.asset_tag,
          asset_type: a.asset_type,
          assigned_date: a.assigned_date,
          return_status: a.external_return_status === 'returned' ? 'returned' : 'pending_return',
          condition: a.external_return_status === 'damaged' ? 'damaged' : 'good',
          recovery_amount: a.estimated_recovery_amount,
          clearance_notes: `Synced from ${extAssets.source_system}. S/N: ${a.serial_number}`,
          created_at: nowIso,
          updated_at: nowIso,
        }));
      }

      defaultFnf.payable_days = extAtt.calculated_payable_days;
      defaultFnf.leave_encashment_days = extLeave.total_encashable_days;
      defaultFnf.asset_recovery_amount = extAssets.total_recovery_required;
      defaultFnf.remarks = `External systems synced: Attendance (${extAtt.calculated_payable_days} payable days), Leave (${extLeave.total_encashable_days} encashable days), Asset recovery (₹${extAssets.total_recovery_required.toLocaleString('en-IN')}).`;
    } catch {
      // Fallback
    }

    // Save to memory store
    MEMORY_OFFBOARDING_STORE.set(caseId, {
      caseRecord: newCase,
      checklist: defaultChecklist,
      assets: initialAssets,
      ndc: defaultNdc,
      fnf: defaultFnf,
      activityLogs: initialActivity,
      documents: [],
      externalAssetsSummary: extAssetsSummary,
      externalAttendanceSummary: extAttSummary,
      externalLeaveSummary: extLeaveSummary,
    });


    // Attempt persist to Supabase if tables exist
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.from('offboarding_cases').insert({
        id: newCase.id,
        employee_id: newCase.employee_id,
        exit_type: newCase.exit_type,
        initiated_date: newCase.initiated_date,
        initiated_by: newCase.initiated_by,
        proposed_lwd: newCase.proposed_lwd,
        actual_lwd: newCase.actual_lwd,
        notice_period_days: newCase.notice_period_days,
        notice_period_waived: newCase.notice_period_waived,
        reason: newCase.reason,
        reason_details: newCase.reason_details,
        status: newCase.status,
        immediate_relieving: newCase.immediate_relieving,
        exception_notes: newCase.exception_notes,
      });

      await supabase.from('offboarding_checklists').insert(defaultChecklist);
      await supabase.from('offboarding_ndc').insert(defaultNdc);
      await supabase.from('offboarding_fnf').insert(defaultFnf);
      await supabase.from('offboarding_activity_log').insert(initialActivity);
    } catch {
      // Table missing - memory store handles it
    }

    // Record in global audit log
    await recordAuditLog('offboarding_cases', caseId, 'insert', {
      employee_id: input.employee_id,
      employee_name: input.employee_name,
      exit_type: input.exit_type,
      proposed_lwd: input.proposed_lwd,
    });

    // Send resignation formal acknowledgment email
    try {
      await sendEmail(
        'offboarding_resignation_ack',
        {
          subject: 'Acknowledgment of Resignation — NavGurukul Foundation',
          employee_name: input.employee_name,
          resignation_date: input.initiated_date,
          notice_period_duration: `${noticeDays} Days`,
          last_working_day: input.proposed_lwd,
          offboarding_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${caseId}`,
          hr_poc_name: 'People & Culture Operations',
        },
        input.employee_email
      );
    } catch (mailErr) {
      console.warn('Could not dispatch initial resignation email:', mailErr);
    }

    revalidatePath('/offboarding');
    revalidatePath('/employees');
    await auditOffboarding.caseOpened({
      subject: auditSubject(newCase),
      actorName: newCase.initiated_by,
      entityId: caseId,
      exitType: newCase.exit_type,
      metadata: {
        proposed_lwd: newCase.proposed_lwd,
        notice_period_days: noticeDays,
        reason: newCase.reason,
      },
    });

    return { success: true, caseId };
  } catch (err: any) {
    console.error('Error initiating offboarding:', err);
    return { success: false, error: err?.message || 'Failed to initiate offboarding case' };
  }
}

/**
 * Update a checklist item status or details.
 */
export async function updateChecklistItem(
  caseId: string,
  itemId: string,
  updates: Partial<OffboardingChecklistItem>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const itemIndex = existing.checklist.findIndex((c) => c.id === itemId);
  if (itemIndex === -1) return { success: false, error: 'Checklist item not found' };

  const nowIso = new Date().toISOString();
  const oldItem = existing.checklist[itemIndex];
  const updatedItem: OffboardingChecklistItem = {
    ...oldItem,
    ...updates,
    updated_at: nowIso,
    completed_at: updates.status === 'completed' ? nowIso : updates.status ? null : oldItem.completed_at,
  };

  existing.checklist[itemIndex] = updatedItem;

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-chk`,
    offboarding_id: caseId,
    actor_name: updates.completed_by || 'P&C Operations',
    actor_role: 'pnc',
    action: 'Checklist Item Updated',
    description: `"${updatedItem.title}" marked as ${updatedItem.status.toUpperCase()}${updates.notes ? ` — Note: ${updates.notes}` : ''}`,
    created_at: nowIso,
  });

  // DB Sync
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_checklists').update(updates).eq('id', itemId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_checklists', itemId, 'update', {
    caseId,
    title: updatedItem.title,
    status: updatedItem.status,
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update an asset clearance status.
 */
export async function updateAssetClearance(
  caseId: string,
  assetId: string,
  updates: Partial<OffboardingAssetItem>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const assetIndex = existing.assets.findIndex((a) => a.id === assetId);
  if (assetIndex === -1) return { success: false, error: 'Asset record not found' };

  const nowIso = new Date().toISOString();
  const updatedAsset: OffboardingAssetItem = {
    ...existing.assets[assetIndex],
    ...updates,
    updated_at: nowIso,
    verified_at: updates.return_status === 'cleared' || updates.return_status === 'returned' ? nowIso : existing.assets[assetIndex].verified_at,
  };

  existing.assets[assetIndex] = updatedAsset;

  // Update IT NDC status automatically if all assets cleared
  const allAssetsCleared = existing.assets.every(
    (a) => a.return_status === 'cleared' || a.return_status === 'returned' || a.return_status === 'waived'
  );

  const itNdc = existing.ndc.find((n) => n.department === 'it_admin');
  if (itNdc) {
    if (allAssetsCleared && itNdc.status !== 'cleared') {
      itNdc.status = 'cleared';
      itNdc.cleared_at = nowIso;
      itNdc.cleared_by = updates.verified_by || 'IT Admin Desk';
      itNdc.remarks = 'All assigned assets inspected and verified cleared.';
      itNdc.blocker_reason = null;
    } else if (!allAssetsCleared && updatedAsset.return_status === 'under_recovery') {
      itNdc.status = 'blocked';
      itNdc.blocker_reason = `Asset recovery pending: ₹${updatedAsset.recovery_amount || 0}`;
    }
  }

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-asset`,
    offboarding_id: caseId,
    actor_name: updates.verified_by || 'IT Asset Desk',
    actor_role: 'it_admin',
    action: 'Asset Clearance Status Changed',
    description: `Asset "${updatedAsset.asset_name}" marked as ${updatedAsset.return_status.toUpperCase()}${updatedAsset.clearance_notes ? ` (${updatedAsset.clearance_notes})` : ''}`,
    created_at: nowIso,
  });

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_asset_clearances').update(updates).eq('id', assetId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_asset_clearances', assetId, 'update', {
    caseId,
    asset_name: updatedAsset.asset_name,
    return_status: updatedAsset.return_status,
  });

  await auditOffboarding.clearanceUpdated({
    subject: auditSubject(existing.caseRecord),
    actorName: updates.verified_by || 'IT Asset Desk',
    entityId: caseId,
    area: `Asset — ${updatedAsset.asset_name}`,
    status: updatedAsset.return_status,
    severity: updatedAsset.return_status === 'under_recovery' ? 'warning' : 'info',
    metadata: { asset_id: assetId, recovery_amount: updatedAsset.recovery_amount },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update Departmental NDC (No Dues Certificate) Sign-off.
 */
export async function updateNDCDepartment(
  caseId: string,
  department: string,
  updates: Partial<OffboardingNDCDepartment>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const ndcIndex = existing.ndc.findIndex((n) => n.department === department);
  if (ndcIndex === -1) return { success: false, error: 'Department NDC record not found' };

  const nowIso = new Date().toISOString();
  const updatedNdc: OffboardingNDCDepartment = {
    ...existing.ndc[ndcIndex],
    ...updates,
    updated_at: nowIso,
    cleared_at: updates.status === 'cleared' ? nowIso : updates.status ? null : existing.ndc[ndcIndex].cleared_at,
  };

  existing.ndc[ndcIndex] = updatedNdc;

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-ndc`,
    offboarding_id: caseId,
    actor_name: updates.cleared_by || 'Department Authority',
    actor_role: 'pnc',
    action: 'NDC Clearance Updated',
    description: `${updatedNdc.department_label} clearance marked as ${updatedNdc.status.toUpperCase()}${updates.remarks ? ` — ${updates.remarks}` : ''}`,
    created_at: nowIso,
  });

  // Check if all NDC departments are cleared
  const allNdcCleared = existing.ndc.every((n) => n.status === 'cleared');
  if (allNdcCleared) {
    if (existing.fnf.status === 'awaiting_clearance' || existing.fnf.status === 'not_started') {
      existing.fnf.status = 'computation_pending';
      existing.fnf.blocked_reasons = [];
      existing.fnf.remarks = 'All departmental NDC sign-offs complete. Ready for F&F computation.';
    }
  } else {
    const blockers = existing.ndc
      .filter((n) => n.status !== 'cleared')
      .map((n) => `${n.department_label}: ${n.blocker_reason || n.status}`);
    existing.fnf.blocked_reasons = blockers;
  }

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_ndc').update(updates).eq('offboarding_id', caseId).eq('department', department);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_ndc', caseId, 'update', {
    department,
    status: updatedNdc.status,
  });

  await auditOffboarding.clearanceUpdated({
    subject: auditSubject(existing.caseRecord),
    actorName: updates.cleared_by || 'Department Authority',
    entityId: caseId,
    area: updatedNdc.department_label,
    status: updatedNdc.status,
    severity: updatedNdc.status === 'blocked' ? 'warning' : 'info',
    metadata: { department, remarks: updates.remarks },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update Full & Final (F&F) Settlement Computation & Payment Details.
 */
export async function updateFnFDetails(
  caseId: string,
  updates: Partial<OffboardingFnF>
): Promise<{ success: boolean; error?: string }> {
  // Settling F&F is writing salary data, which the offboarding feature alone
  // does not grant: PnC Ops runs the exit but has `salary: none`.
  const allowed = await guardResource('salary', 'edit');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const nowIso = new Date().toISOString();
  const updatedFnf: OffboardingFnF = {
    ...existing.fnf,
    ...updates,
    updated_at: nowIso,
    processed_at: updates.status === 'processed' ? nowIso : existing.fnf.processed_at,
  };

  existing.fnf = updatedFnf;

  existing.activityLogs.unshift({
    id: `log-${Date.now()}-fnf`,
    offboarding_id: caseId,
    actor_name: updates.processed_by || 'Finance Lead',
    actor_role: 'finance',
    action: 'F&F Settlement Updated',
    // No payment reference here: the activity log is shown to everyone who
    // can open the case, PnC Ops included.
    description: `F&F status transitioned to ${updatedFnf.status.toUpperCase()}`,
    created_at: nowIso,
  });

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_fnf').update(updates).eq('offboarding_id', caseId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_fnf', caseId, 'update', {
    status: updatedFnf.status,
    payable_days: updatedFnf.payable_days,
  });

  await auditOffboarding.fnfSettled({
    subject: auditSubject(existing.caseRecord),
    actorName: updates.processed_by || 'Finance Lead',
    entityId: caseId,
    metadata: {
      status: updatedFnf.status,
      payable_days: updatedFnf.payable_days,
      payment_reference: updatedFnf.payment_reference,
      net_payable_estimate: updatedFnf.net_payable_estimate,
    },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update Proposed or Actual Last Working Day.
 */
export async function updateExitDates(
  caseId: string,
  proposedLwd: string,
  actualLwd?: string | null,
  reasonForAdjustment?: string
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const oldProposed = existing.caseRecord.proposed_lwd;
  existing.caseRecord.proposed_lwd = proposedLwd;
  if (actualLwd !== undefined) {
    existing.caseRecord.actual_lwd = actualLwd;
  }
  existing.caseRecord.updated_at = new Date().toISOString();

  existing.activityLogs.unshift({
    id: `log-${Date.now()}-lwd`,
    offboarding_id: caseId,
    actor_name: 'P&C Operations',
    actor_role: 'pnc',
    action: 'Exit Timeline Adjusted',
    description: `Proposed LWD updated from ${oldProposed} to ${proposedLwd}${actualLwd ? ` (Actual LWD: ${actualLwd})` : ''}${reasonForAdjustment ? `. Reason: ${reasonForAdjustment}` : ''}`,
    created_at: new Date().toISOString(),
  });

  try {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from('offboarding_cases')
      .update({ proposed_lwd: proposedLwd, actual_lwd: actualLwd, updated_at: existing.caseRecord.updated_at })
      .eq('id', caseId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_cases', caseId, 'update', {
    oldProposed,
    newProposed: proposedLwd,
    actualLwd,
  });

  await auditOffboarding.statusChanged({
    subject: auditSubject(existing.caseRecord),
    entityId: caseId,
    to: existing.caseRecord.status,
    severity: 'notice',
    changes: [
      { field: 'proposed_lwd', label: 'Proposed Last Working Day', from: oldProposed, to: proposedLwd },
      ...(actualLwd ? [{ field: 'actual_lwd', label: 'Actual Last Working Day', to: actualLwd }] : []),
    ],
    metadata: { reason: reasonForAdjustment },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Formally Close Exit and officially mark employee as Exited.
 */
export async function closeOffboardingCase(
  caseId: string,
  closedBy: string = 'P&C Operations Lead',
  actualLwd?: string
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  // Verification checks: ensure asset and NDC clearances are fulfilled
  const hasUnclearedAssets = existing.assets.some(
    (a) => a.return_status === 'pending_return' || a.return_status === 'under_recovery'
  );
  if (hasUnclearedAssets && MEMORY_SETTINGS.require_asset_clearance_before_closure) {
    return {
      success: false,
      error: 'Cannot close exit: Outstanding assets are pending return or recovery clearance.',
    };
  }

  const hasPendingNdc = existing.ndc.some((n) => n.status !== 'cleared');
  if (hasPendingNdc && MEMORY_SETTINGS.require_all_ndc_before_fnf) {
    return {
      success: false,
      error: 'Cannot close exit: Not all departments have cleared the No Dues Certificate.',
    };
  }

  const nowIso = new Date().toISOString();
  const finalLwd = actualLwd || existing.caseRecord.actual_lwd || existing.caseRecord.proposed_lwd;

  existing.caseRecord.status = 'completed';
  existing.caseRecord.actual_lwd = finalLwd;
  existing.caseRecord.exit_closed_at = nowIso;
  existing.caseRecord.exit_closed_by = closedBy;
  existing.caseRecord.updated_at = nowIso;

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-close`,
    offboarding_id: caseId,
    actor_name: closedBy,
    actor_role: 'pnc',
    action: 'Exit Case Officially Closed',
    description: `Formal exit closure finalized. Employee records updated to Exited (Official LWD: ${finalLwd}). Relieving documentation issued.`,
    created_at: nowIso,
  });

  // Ensure documents are created
  if (!existing.documents.some((d) => d.document_type === 'experience_letter')) {
    existing.documents.push({
      id: `doc-${Date.now()}-exp`,
      offboarding_id: caseId,
      document_type: 'experience_letter',
      document_name: `Relieving & Experience Certificate — ${existing.caseRecord.employee_name}.pdf`,
      status: 'generated',
      generated_at: nowIso,
    });
  }

  // Update employee record in employees table: status = 'exited', exit_date = finalLwd
  try {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from('employees')
      .update({
        status: 'exited',
        exit_date: finalLwd,
      })
      .eq('id', existing.caseRecord.employee_id);

    // Also update offboarding case table in DB
    await supabase
      .from('offboarding_cases')
      .update({
        status: 'completed',
        actual_lwd: finalLwd,
        exit_closed_at: nowIso,
        exit_closed_by: closedBy,
        updated_at: nowIso,
      })
      .eq('id', caseId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_cases', caseId, 'update', {
    action: 'close_exit',
    status: 'completed',
    actual_lwd: finalLwd,
    closedBy,
  });

  await auditOffboarding.statusChanged({
    subject: auditSubject(existing.caseRecord),
    actorName: closedBy,
    entityId: caseId,
    to: 'completed',
    severity: 'critical',
    metadata: { actual_lwd: finalLwd },
  });

  // Exit closure revokes platform access as a matter of record.
  await auditAccess.revoked({
    subject: auditSubject(existing.caseRecord),
    actorName: closedBy,
    entityId: caseId,
    system: 'All NavGurukul systems',
  });

  // Send formal relieving & experience letter email
  try {
    await sendEmail(
      'offboarding_relieving_experience_letter',
      {
        subject: 'Relieving Documents & Service Certificate — NavGurukul Foundation',
        employee_name: existing.caseRecord.employee_name,
        job_title: existing.caseRecord.employee_designation,
        last_working_day: finalLwd,
        document_download_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${caseId}?tab=documents`,
        finance_poc_email: 'finance@navgurukul.org',
      },
      existing.caseRecord.employee_email
    );
  } catch (mailErr) {
    console.warn('Could not dispatch final relieving email:', mailErr);
  }

  revalidatePath('/offboarding');
  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath('/employees');
  return { success: true };
}

/**
 * Generate an Exit Document (NDC or Experience Letter).
 */
export async function generateExitDocument(
  caseId: string,
  docType: 'ndc' | 'experience_letter' | 'relieving_letter'
): Promise<{ success: boolean; document?: ExitDocument; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const nowIso = new Date().toISOString();
  const docName =
    docType === 'ndc'
      ? `No Dues Certificate — ${existing.caseRecord.employee_name}.pdf`
      : `Relieving & Experience Certificate — ${existing.caseRecord.employee_name}.pdf`;

  const newDoc: ExitDocument = {
    id: `doc-${Date.now()}-${docType}`,
    offboarding_id: caseId,
    document_type: docType,
    document_name: docName,
    status: 'generated',
    generated_at: nowIso,
  };

  const docIdx = existing.documents.findIndex((d) => d.document_type === docType);
  if (docIdx >= 0) {
    existing.documents[docIdx] = newDoc;
  } else {
    existing.documents.push(newDoc);
  }

  existing.activityLogs.unshift({
    id: `log-${Date.now()}-doc`,
    offboarding_id: caseId,
    actor_name: 'P&C Operations',
    actor_role: 'pnc',
    action: 'Exit Document Generated',
    description: `Generated ${docName}.`,
    created_at: nowIso,
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true, document: newDoc };
}

/**
 * Send Automated Reminders for pending offboarding actions.
 */
export async function sendOffboardingReminders(): Promise<{
  success: boolean;
  remindersSent: number;
  details: string[];
}> {
  // The "send reminders" button on the offboarding screen. The scheduled run
  // does not come through here: it has no session to guard, so it lives in
  // `reminders.ts`, which only the cron route imports.
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, remindersSent: 0, details: [allowed.error] };

  const cases = Array.from(MEMORY_OFFBOARDING_STORE.values()).filter(
    (c) => c.caseRecord.status === 'notice_period' || c.caseRecord.status === 'clearance_in_progress'
  );

  let remindersSent = 0;
  const details: string[] = [];

  for (const c of cases) {
    const pendingNdcDepts = c.ndc.filter((n) => n.status !== 'cleared').map((n) => n.department_label);
    const pendingChecklist = c.checklist.filter((i) => i.status !== 'completed' && i.status !== 'waived');

    if (pendingNdcDepts.length > 0 || pendingChecklist.length > 0) {
      try {
        const mailResult = await sendEmail(
          'offboarding_clearance_reminder',
          {
            subject: `Action Required: Clearance Checkpoints for ${c.caseRecord.employee_name} (LWD: ${c.caseRecord.proposed_lwd})`,
            employee_name: c.caseRecord.employee_name,
            last_working_day: c.caseRecord.proposed_lwd,
            pending_departments: pendingNdcDepts.join(', ') || 'Pending Checkpoints',
            clearance_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${c.caseRecord.id}`,
          },
          c.caseRecord.employee_email
        );

        if (mailResult.success) {
          remindersSent++;
          details.push(`Reminder sent to ${c.caseRecord.employee_name} for ${pendingNdcDepts.length} pending clearances.`);

          c.activityLogs.unshift({
            id: `log-${Date.now()}-rem`,
            offboarding_id: c.caseRecord.id,
            actor_name: 'Automated Reminder Engine',
            actor_role: 'system',
            action: 'Automated Clearance Reminder Dispatched',
            description: `Sent reminder for pending departments: ${pendingNdcDepts.join(', ')}.`,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error('Failed to send reminder for case:', c.caseRecord.id, err);
      }
    }
  }

  return { success: true, remindersSent, details };
}

/**
 * Get configurable offboarding policy settings.
 */
export async function getOffboardingSettings(): Promise<OffboardingSettings> {
  // Read by the Offboarding tab of /manage/settings as well as by the exit
  // screens, so either feature admits. The policy holds nothing sensitive;
  // a refused caller gets the built-in defaults.
  const allowed = await guard([...FEATURE_ACCESS.offboarding, ...FEATURE_ACCESS.platformConfig]);
  if (!allowed.ok) return { ...DEFAULT_OFFBOARDING_SETTINGS };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('offboarding_settings').select('*').limit(1).single();
    if (!error && data) {
      MEMORY_SETTINGS = { ...DEFAULT_OFFBOARDING_SETTINGS, ...data };
      return MEMORY_SETTINGS;
    }
  } catch {
    // fallback
  }

  return MEMORY_SETTINGS;
}

/**
 * Update offboarding policy settings.
 */
export async function updateOffboardingSettings(
  settings: Partial<OffboardingSettings>
): Promise<{ success: boolean; error?: string }> {
  // This is the Offboarding tab of /manage/settings, which PnC Admin reaches
  // read-only, so it answers to the same guard as the writes in
  // settings/service.ts.
  const refused = await platformConfigRefusal();
  if (refused) return refused;

  MEMORY_SETTINGS = { ...MEMORY_SETTINGS, ...settings, updated_at: new Date().toISOString() };

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_settings').upsert({
      ...MEMORY_SETTINGS,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_settings', 'singleton', 'update', settings);
  revalidatePath('/manage/settings/offboarding');
  return { success: true };
}

// ============================================================================
// STAGE 1: RESIGNATION REQUESTS & DECISION WORKFLOW ENGINE
// ============================================================================

const MEMORY_RESIGNATION_STORE: Map<string, ResignationRequest> = new Map();

function initResignationSeedScenarios() {
  if (MEMORY_RESIGNATION_STORE.size > 0) return;

  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return formatYMD(d);
  };
  const daysAhead = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return formatYMD(d);
  };

  const requests: ResignationRequest[] = [
    // 1. New resignation awaiting Manager/P&C review (Platform)
    {
      id: 'res-req-001',
      employee_id: 'emp-divya-sharma',
      employee_name: 'Divya Sharma',
      employee_email: 'divya.sharma@navgurukul.org',
      employee_designation: 'Senior Curriculum Associate',
      employee_department: 'Academia',
      manager_name: 'Ananya Sen',
      source: 'platform',
      resignation_date: daysAgo(1),
      proposed_lwd: daysAhead(29),
      notice_period_days: 30,
      reason: 'Relocating to home state for family care',
      reason_details: 'Need to support elderly family members in Bhopal; looking for remote or regional opportunities.',
      employee_comments: 'Grateful for the incredible learning and mentorship over the past 2 years at NavGurukul.',
      manager_decision: 'pending',
      pnc_decision: 'pending',
      employee_retention_response: 'pending',
      status: 'submitted',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    // 2. Manager accepted, P&C pending (Platform)
    {
      id: 'res-req-002',
      employee_id: 'emp-arjun-nair',
      employee_name: 'Arjun Nair',
      employee_email: 'arjun.nair@navgurukul.org',
      employee_designation: 'Full Stack Coding Mentor',
      employee_department: 'School of Programming',
      manager_name: 'Rohit Kulkarni',
      source: 'platform',
      resignation_date: daysAgo(3),
      proposed_lwd: daysAhead(27),
      notice_period_days: 30,
      reason: 'Pursuing higher studies (M.Tech in CS)',
      reason_details: 'GATE qualifying rank secured; joining IISc Bengaluru next semester.',
      employee_comments: 'Will ensure comprehensive sprint handover to junior mentors before departure.',
      manager_decision: 'accepted',
      manager_decision_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      manager_decision_by: 'Rohit Kulkarni (Engineering Lead)',
      manager_notes: 'Discussed with Arjun. Valid educational aspiration; support transition with standard 30-day notice.',
      pnc_decision: 'pending',
      employee_retention_response: 'pending',
      status: 'pnc_pending',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    // 3. P&C accepted, Manager pending (P&C Entry)
    {
      id: 'res-req-003',
      employee_id: 'emp-meera-joshi',
      employee_name: 'Meera Joshi',
      employee_email: 'meera.joshi@navgurukul.org',
      employee_designation: 'Admissions & Outreach Specialist',
      employee_department: 'Operations',
      manager_name: 'Manish Rawat',
      source: 'pnc',
      resignation_date: daysAgo(4),
      proposed_lwd: daysAhead(26),
      notice_period_days: 30,
      reason: 'Career pivot into civil services preparation',
      reason_details: 'Enrolling in full-time UPSC civil services fellowship academy.',
      employee_comments: 'Verbal notice provided to P&C partner during 1:1 sync.',
      manager_decision: 'pending',
      pnc_decision: 'accepted',
      pnc_decision_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      pnc_decision_by: 'P&C Operations Partner',
      pnc_notes: 'Acknowledged verbal notice; manager review pending.',
      employee_retention_response: 'pending',
      status: 'manager_pending',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    // 4. Both accepted -> Offboarding initiated (Linked to existing Case A: Vikram Patel)
    {
      id: 'res-req-004',
      employee_id: 'emp-vikram-patel',
      employee_name: 'Vikram Patel',
      employee_email: 'vikram.patel@navgurukul.org',
      employee_designation: 'Lead Pedagogical Designer',
      employee_department: 'Academia',
      manager_name: 'Ananya Sen',
      source: 'platform',
      resignation_date: daysAgo(20),
      proposed_lwd: daysAhead(10),
      notice_period_days: 30,
      reason: 'Pursuing higher education / Ph.D. opportunity abroad',
      reason_details: 'Doctoral fellowship in education technology in Europe commencing autumn.',
      employee_comments: 'Submitting notice as discussed with leadership.',
      manager_decision: 'accepted',
      manager_decision_at: daysAgo(19),
      manager_decision_by: 'Ananya Sen',
      manager_notes: 'Approved. Ph.D. fellowship validated.',
      pnc_decision: 'accepted',
      pnc_decision_at: daysAgo(19),
      pnc_decision_by: 'P&C Operations',
      pnc_notes: 'Resignation accepted. Offboarding case generated.',
      employee_retention_response: 'pending',
      status: 'resignation_accepted',
      offboarding_case_id: 'off-case-001-vikram-patel',
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 19).toISOString(),
    },
    // 5. On hold -> 7-day retention window
    {
      id: 'res-req-005',
      employee_id: 'emp-rohit-kulkarni',
      employee_name: 'Rohit Kulkarni',
      employee_email: 'rohit.kulkarni@navgurukul.org',
      employee_designation: 'Engineering Operations Lead',
      employee_department: 'Engineering',
      manager_name: 'Ananya Sen',
      source: 'platform',
      resignation_date: daysAgo(2),
      proposed_lwd: daysAhead(28),
      notice_period_days: 30,
      reason: 'Exhaustion & burnout from recent campus expansion sprints',
      reason_details: 'Feeling stretched across multi-campus infrastructure rollout.',
      employee_comments: 'Would love to stay if workload balancing can be achieved.',
      manager_decision: 'on_hold',
      manager_decision_at: daysAgo(1),
      manager_decision_by: 'Ananya Sen',
      manager_notes: 'Requested 7-day hold window to restructure engineering pods and explore sabbatical/workload balance.',
      pnc_decision: 'pending',
      hold_until_date: daysAhead(5),
      retention_notes: '7-day retention discussion active. Meeting scheduled for Friday with Head of Org.',
      employee_retention_response: 'pending',
      status: 'on_hold',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    // 6. Retention proposed -> Employee decision pending
    {
      id: 'res-req-006',
      employee_id: 'emp-sneha-reddy',
      employee_name: 'Sneha Reddy',
      employee_email: 'sneha.reddy@navgurukul.org',
      employee_designation: 'Student Placement & Corporate Partnerships Manager',
      employee_department: 'Placement Cell',
      manager_name: 'Manish Rawat',
      source: 'platform',
      resignation_date: daysAgo(5),
      proposed_lwd: daysAhead(25),
      notice_period_days: 30,
      reason: 'External offer from tech corporate placement agency',
      reason_details: 'Higher compensation offer received.',
      employee_comments: 'Open to discussing if NavGurukul can match career roadmap.',
      manager_decision: 'retention_proposed',
      manager_decision_at: daysAgo(3),
      manager_decision_by: 'Manish Rawat',
      manager_notes: 'High performer. Proposing band progression + leadership over corporate CSR alliances.',
      pnc_decision: 'retention_proposed',
      pnc_decision_at: daysAgo(2),
      pnc_decision_by: 'P&C Leadership',
      pnc_notes: 'Retention package drafted: 18% band revision + title elevation to Associate Director.',
      retention_notes: 'Formal retention offer sent to employee. Awaiting Sneha\'s confirmation.',
      employee_retention_response: 'pending',
      status: 'withdrawal_proposed',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    // 7. Employee accepts withdrawal -> Resignation closed (Employee remains active!)
    {
      id: 'res-req-007',
      employee_id: 'emp-karan-singh',
      employee_name: 'Karan Singh',
      employee_email: 'karan.singh@navgurukul.org',
      employee_designation: 'Campus Network & Systems Admin',
      employee_department: 'IT Infrastructure',
      manager_name: 'Rohit Kulkarni',
      source: 'platform',
      resignation_date: daysAgo(10),
      proposed_lwd: daysAhead(20),
      notice_period_days: 30,
      reason: 'Commute distance and work-life balance',
      employee_comments: 'Daily commute of 3 hours to Dharamshala center was difficult.',
      manager_decision: 'retention_proposed',
      manager_decision_at: daysAgo(8),
      manager_decision_by: 'Rohit Kulkarni',
      manager_notes: 'Proposed 3-day hybrid remote schedule + campus accommodation allowance.',
      pnc_decision: 'retention_proposed',
      pnc_decision_at: daysAgo(7),
      pnc_decision_by: 'P&C Operations',
      pnc_notes: 'Retention package ratified.',
      employee_retention_response: 'accepted_withdrawal',
      employee_response_at: daysAgo(6),
      employee_response_notes: 'I accept the hybrid remote arrangement and withdraw my resignation with gratitude.',
      status: 'withdrawn_by_employee',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: daysAgo(6),
    },
    // 8. Employee declines withdrawal -> Resignation accepted -> Offboarding initiated
    {
      id: 'res-req-008',
      employee_id: 'emp-tanya-bhatia',
      employee_name: 'Tanya Bhatia',
      employee_email: 'tanya.bhatia@navgurukul.org',
      employee_designation: 'Data Science & Python Faculty',
      employee_department: 'Academia',
      manager_name: 'Ananya Sen',
      source: 'platform',
      resignation_date: daysAgo(14),
      proposed_lwd: daysAhead(16),
      notice_period_days: 30,
      reason: 'Starting an independent AI ed-tech venture',
      manager_decision: 'retention_proposed',
      manager_decision_at: daysAgo(12),
      manager_decision_by: 'Ananya Sen',
      manager_notes: 'Offered adjunct fellow role.',
      pnc_decision: 'retention_proposed',
      pnc_decision_at: daysAgo(11),
      pnc_decision_by: 'P&C Leadership',
      pnc_notes: 'Retention package offered.',
      employee_retention_response: 'declined_withdrawal',
      employee_response_at: daysAgo(10),
      employee_response_notes: 'Appreciate the generous offer, but I have already committed to starting my venture.',
      status: 'resignation_accepted',
      offboarding_case_id: 'off-case-006-tanya-bhatia',
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      updated_at: daysAgo(10),
    },
    // 9. Manager/P&C Disagreement -> Decision Pending / P&C Resolution
    {
      id: 'res-req-009',
      employee_id: 'emp-aditi-rao',
      employee_name: 'Aditi Rao',
      employee_email: 'aditi.rao@navgurukul.org',
      employee_designation: 'Community Evangelist & Campus Culture Lead',
      employee_department: 'Community',
      manager_name: 'Manish Rawat',
      source: 'platform',
      resignation_date: daysAgo(4),
      proposed_lwd: daysAhead(26),
      notice_period_days: 30,
      reason: 'Seeking higher role in global non-profit',
      manager_decision: 'accepted',
      manager_decision_at: daysAgo(3),
      manager_decision_by: 'Manish Rawat',
      manager_notes: 'Manager accepted. Valid progression opportunity.',
      pnc_decision: 'retention_proposed',
      pnc_decision_at: daysAgo(2),
      pnc_decision_by: 'P&C Operations',
      pnc_notes: 'P&C recommends retention: Upcoming winter student batch onboarding needs her campus leadership.',
      status: 'decision_pending',
      retention_notes: 'Disagreement between Manager acceptance and P&C retention proposal. P&C Lead review needed.',
      employee_retention_response: 'pending',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: daysAgo(2),
    },
    // 10. Email-originated resignation (with complete email headers and body)
    {
      id: 'res-req-010',
      employee_id: 'emp-sanjay-gupta',
      employee_name: 'Sanjay Gupta',
      employee_email: 'sanjay.gupta@navgurukul.org',
      employee_designation: 'Cloud Infrastructure & DevOps Engineer',
      employee_department: 'Engineering',
      manager_name: 'Rohit Kulkarni',
      source: 'email',
      resignation_date: daysAgo(2),
      proposed_lwd: daysAhead(28),
      notice_period_days: 30,
      reason: 'Offer from open-source foundation (Remote EU team)',
      reason_details: 'Accepted offer as Core Infrastructure Maintainer.',
      email_subject: 'Resignation Notice & Transition Timeline — Sanjay Gupta (DevOps)',
      email_sender: 'sanjay.gupta@navgurukul.org',
      email_received_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      email_body: `Dear Rohit and People & Culture Team,\n\nPlease accept this email as formal notification that I am resigning from my position as Cloud Infrastructure & DevOps Engineer at NavGurukul. As per my employment terms, my standard notice period is 30 days, placing my proposed last working day on ${daysAhead(28)}.\n\nI want to express my deepest gratitude for the opportunities I have had over the last two years. Working with the student engineers and automating our campus labs has been one of the most rewarding periods of my career.\n\nI am fully committed to ensuring a smooth transition of all AWS architecture, Kubernetes clusters, and monitoring scripts to the team over the next 4 weeks.\n\nSincerely,\nSanjay Gupta\nDevOps Engineering Team`,
      manager_decision: 'pending',
      pnc_decision: 'pending',
      employee_retention_response: 'pending',
      status: 'submitted',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    // 11. P&C-originated resignation
    {
      id: 'res-req-011',
      employee_id: 'emp-kavita-mishra',
      employee_name: 'Kavita Mishra',
      employee_email: 'kavita.mishra@navgurukul.org',
      employee_designation: 'Fellowship Program Associate',
      employee_department: 'Operations',
      manager_name: 'Manish Rawat',
      source: 'pnc',
      resignation_date: daysAgo(3),
      proposed_lwd: daysAhead(27),
      notice_period_days: 30,
      reason: 'Personal and family medical circumstances',
      reason_details: 'Direct verbal resignation logged by P&C Partner during campus visit.',
      manager_decision: 'pending',
      pnc_decision: 'accepted',
      pnc_decision_at: daysAgo(2),
      pnc_decision_by: 'P&C Operations Partner',
      pnc_notes: 'Direct intake recorded. Awaiting reporting manager sign-off.',
      employee_retention_response: 'pending',
      status: 'manager_pending',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: daysAgo(2),
    },
    // 12. Platform-originated resignation
    {
      id: 'res-req-012',
      employee_id: 'emp-harish-kumar',
      employee_name: 'Harish Kumar',
      employee_email: 'harish.kumar@navgurukul.org',
      employee_designation: 'Mobile Development Educator',
      employee_department: 'Academia',
      manager_name: 'Ananya Sen',
      source: 'platform',
      resignation_date: daysAgo(1),
      proposed_lwd: daysAhead(29),
      notice_period_days: 30,
      reason: 'Joining a fintech startup as Lead Flutter Architect',
      employee_comments: 'Will document all Flutter and React Native cohort curriculum before leaving.',
      manager_decision: 'pending',
      pnc_decision: 'pending',
      employee_retention_response: 'pending',
      status: 'submitted',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ];

  for (const r of requests) {
    MEMORY_RESIGNATION_STORE.set(r.id, r);
  }
}

/**
 * Fetch all resignation requests.
 * Uses a fast timeout to avoid hanging when the resignation_requests table
 * doesn't exist in the remote database.
 */
export async function getAllResignationRequests(): Promise<ResignationRequest[]> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return [];

  initResignationSeedScenarios();
  initSeedScenarios();

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('resignation_requests')
      .select('*, employees(name, email, team)')
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        ...row,
        employee_name: row.employees?.name || row.employee_name,
        employee_email: row.employees?.email || row.employee_email,
      }));
    }
  } catch {
    // Fallback to memory (timeout, missing table, or network error)
  }

  return Array.from(MEMORY_RESIGNATION_STORE.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Fetch a single resignation request by ID.
 */
export async function getResignationRequestById(id: string): Promise<ResignationRequest | null> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return null;

  initResignationSeedScenarios();

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('resignation_requests')
      .select('*, employees(*)')
      .eq('id', id)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timeout);

    if (!error && data) {
      return {
        ...data,
        employee_name: data.employees?.name || data.employee_name,
        employee_email: data.employees?.email || data.employee_email,
      };
    }
  } catch {
    // Fallback (timeout, missing table, or network error)
  }

  return MEMORY_RESIGNATION_STORE.get(id) || null;
}

/**
 * Submit a Resignation Request (Entry Points: Platform, Ingested Email, or P&C Manual Entry).
 * Does NOT create an Offboarding Case!
 */
export async function submitResignationRequest(
  input: SubmitResignationInput
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  // P&C log resignations for anyone, from any channel. Anyone else may only
  // resign themselves, through the platform: an email or P&C entry is not
  // theirs to file, and a P&C entry is accepted on P&C's behalf the moment
  // it is created.
  const allowed = await guard('offboarding');
  if (!allowed.ok) {
    const self = await guard('self');
    const ownId = self.ok ? await currentEmployeeId() : null;
    if (!ownId || ownId !== input.employee_id || input.source !== 'platform') {
      return { success: false, error: allowed.error };
    }
  }

  initResignationSeedScenarios();

  try {
    const allEmployees = await getEmployees();
    const emp = allEmployees.find((e) => e.id === input.employee_id);

    const nowIso = new Date().toISOString();
    const requestId = `res-req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newRequest: ResignationRequest = {
      id: requestId,
      employee_id: input.employee_id,
      employee_name: emp?.name || 'NavGurukul Member',
      employee_email: emp?.email || 'member@navgurukul.org',
      employee_designation: emp?.employee_type || 'Team Member',
      employee_department: emp?.team || 'Operations',
      manager_name: 'Reporting Manager',
      source: input.source,
      resignation_date: input.resignation_date || nowIso.split('T')[0],
      proposed_lwd: input.proposed_lwd,
      notice_period_days: input.notice_period_days || 30,
      reason: input.reason,
      reason_details: input.reason_details,
      employee_comments: input.employee_comments,
      email_subject: input.email_subject,
      email_sender: input.email_sender,
      email_body: input.email_body,
      email_received_at: input.source === 'email' ? nowIso : null,
      manager_decision: 'pending',
      pnc_decision: input.source === 'pnc' ? 'accepted' : 'pending',
      pnc_decision_at: input.source === 'pnc' ? nowIso : null,
      pnc_decision_by: input.source === 'pnc' ? 'P&C Operations Partner' : null,
      employee_retention_response: 'pending',
      status: input.source === 'pnc' ? 'manager_pending' : 'submitted',
      created_at: nowIso,
      updated_at: nowIso,
    };

    MEMORY_RESIGNATION_STORE.set(requestId, newRequest);

    // Attempt persist to Supabase
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.from('resignation_requests').insert({
        id: newRequest.id,
        employee_id: newRequest.employee_id,
        source: newRequest.source,
        resignation_date: newRequest.resignation_date,
        proposed_lwd: newRequest.proposed_lwd,
        notice_period_days: newRequest.notice_period_days,
        reason: newRequest.reason,
        reason_details: newRequest.reason_details,
        employee_comments: newRequest.employee_comments,
        email_subject: newRequest.email_subject,
        email_sender: newRequest.email_sender,
        email_body: newRequest.email_body,
        email_received_at: newRequest.email_received_at,
        manager_decision: newRequest.manager_decision,
        pnc_decision: newRequest.pnc_decision,
        status: newRequest.status,
      });
    } catch {
      // Memory fallback handles it
    }

    // Global audit trail
    await recordAuditLog('resignation_requests', requestId, 'insert', {
      source: input.source,
      employee_id: input.employee_id,
      employee_name: newRequest.employee_name,
      proposed_lwd: input.proposed_lwd,
    });

    // Notify Manager + P&C of new submission
    try {
      await sendEmail(
        'offboarding_resignation_ack',
        {
          subject: `Resignation Request Received: ${newRequest.employee_name} (${input.source.toUpperCase()})`,
          employee_name: newRequest.employee_name,
          resignation_date: newRequest.resignation_date,
          notice_period_duration: `${newRequest.notice_period_days} Days`,
          last_working_day: newRequest.proposed_lwd,
          offboarding_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding?tab=resignations`,
          hr_poc_name: 'People & Culture Review Board',
        },
        newRequest.employee_email
      );
    } catch (mailErr) {
      console.warn('Could not dispatch resignation notification email:', mailErr);
    }

    await auditOffboarding.resignationReceived({
      subject: auditSubject(newRequest),
      actorType: newRequest.source === 'platform' ? 'employee' : 'pnc',
      actorName: newRequest.employee_name,
      entityId: newRequest.id,
      channel: newRequest.source,
      lastWorkingDay: newRequest.proposed_lwd,
      metadata: {
        reason: newRequest.reason,
        notice_period_days: newRequest.notice_period_days,
      },
    });

    revalidatePath('/offboarding');
    return { success: true, request: newRequest };
  } catch (err: any) {
    console.error('Error submitting resignation request:', err);
    return { success: false, error: err?.message || 'Failed to submit resignation request' };
  }
}

/**
 * Record Manager or P&C Decision on a Resignation Request.
 * Decisions: 'accepted' | 'retention_proposed' | 'on_hold'.
 */
export async function submitReviewDecision(
  requestId: string,
  reviewerRole: 'manager' | 'pnc',
  decision: ReviewDecision,
  notes?: string,
  holdDays?: number
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  initResignationSeedScenarios();
  const req = MEMORY_RESIGNATION_STORE.get(requestId);
  if (!req) return { success: false, error: 'Resignation request not found' };

  const nowIso = new Date().toISOString();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  // Update specific reviewer decision
  if (reviewerRole === 'manager') {
    req.manager_decision = decision;
    req.manager_decision_at = nowIso;
    req.manager_decision_by = 'Reporting Manager';
    req.manager_notes = notes || null;
  } else {
    req.pnc_decision = decision;
    req.pnc_decision_at = nowIso;
    req.pnc_decision_by = 'P&C Operations';
    req.pnc_notes = notes || null;
  }

  // Lifecycle state evaluation
  if (decision === 'on_hold' || req.manager_decision === 'on_hold' || req.pnc_decision === 'on_hold') {
    const days = holdDays || MEMORY_SETTINGS.standard_hold_period_days || 7;
    const holdDate = new Date();
    holdDate.setDate(holdDate.getDate() + days);
    req.hold_until_date = formatYMD(holdDate);
    req.status = 'on_hold';
    req.retention_notes = notes ? `Hold Reason: ${notes}` : `7-day retention discussion window initiated.`;
  } else if (req.manager_decision === 'accepted' && req.pnc_decision === 'accepted') {
    // BOTH ACCEPTED -> Transition to Resignation Accepted & Activate Offboarding Case!
    req.status = 'resignation_accepted';

    // Activate the downstream offboarding case
    const initRes = await openOffboardingCase({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      employee_email: req.employee_email,
      employee_designation: req.employee_designation,
      employee_department: req.employee_department,
      employee_type: 'Full-Time Employee',
      manager_name: req.manager_name || 'Reporting Manager',
      exit_type: 'resignation',
      initiated_date: req.resignation_date,
      initiated_by: `Approved by Manager & P&C (Request ${req.id})`,
      proposed_lwd: req.proposed_lwd,
      notice_period_days: req.notice_period_days,
      reason: req.reason,
      reason_details: req.reason_details || undefined,
    });

    if (initRes.success && initRes.caseId) {
      req.offboarding_case_id = initRes.caseId;
    }
  } else if (req.manager_decision === 'retention_proposed' && req.pnc_decision === 'retention_proposed') {
    // BOTH PROPOSE RETENTION -> Surface retention proposal to employee
    req.status = 'withdrawal_proposed';
    req.retention_notes = notes || 'Management proposes retention dialogue and resignation withdrawal.';
  } else if (
    (req.manager_decision === 'accepted' && req.pnc_decision === 'retention_proposed') ||
    (req.manager_decision === 'retention_proposed' && req.pnc_decision === 'accepted')
  ) {
    // DISAGREEMENT -> Decision Pending / P&C Resolution
    req.status = 'decision_pending';
    req.retention_notes = `Disagreement between Manager (${req.manager_decision}) and P&C (${req.pnc_decision}). Resolution required.`;
  } else if (req.manager_decision === 'accepted' && req.pnc_decision === 'pending') {
    req.status = 'pnc_pending';
  } else if (req.pnc_decision === 'accepted' && req.manager_decision === 'pending') {
    req.status = 'manager_pending';
  } else if (req.manager_decision === 'retention_proposed' || req.pnc_decision === 'retention_proposed') {
    req.status = 'withdrawal_proposed';
    req.retention_notes = notes || 'Retention proposed. Awaiting employee feedback.';
  }

  req.updated_at = nowIso;
  MEMORY_RESIGNATION_STORE.set(requestId, req);

  // Update Supabase if available
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('resignation_requests').update({
      manager_decision: req.manager_decision,
      manager_decision_at: req.manager_decision_at,
      manager_decision_by: req.manager_decision_by,
      manager_notes: req.manager_notes,
      pnc_decision: req.pnc_decision,
      pnc_decision_at: req.pnc_decision_at,
      pnc_decision_by: req.pnc_decision_by,
      pnc_notes: req.pnc_notes,
      hold_until_date: req.hold_until_date,
      retention_notes: req.retention_notes,
      status: req.status,
      offboarding_case_id: req.offboarding_case_id,
      updated_at: nowIso,
    }).eq('id', requestId);
  } catch {
    // fallback
  }

  await recordAuditLog('resignation_requests', requestId, 'update', {
    reviewerRole,
    decision,
    newStatus: req.status,
    notes,
  });

  await auditOffboarding.statusChanged({
    subject: auditSubject(req),
    actorType: reviewerRole === 'manager' ? 'manager' : 'pnc',
    actorName: reviewerRole === 'manager' ? req.manager_decision_by : req.pnc_decision_by,
    entityId: requestId,
    to: req.status,
    severity: 'notice',
    changes: [
      {
        field: `${reviewerRole}_decision`,
        label: reviewerRole === 'manager' ? 'Manager Decision' : 'P&C Decision',
        to: decision,
      },
    ],
    metadata: { notes, hold_until: req.hold_until_date },
  });

  revalidatePath('/offboarding');
  return { success: true, request: req };
}

/**
 * Handle Employee Response to Retention Proposal:
 * - 'accepted_withdrawal': Employee agrees to stay! Resignation closed. Employee remains Active. No offboarding case created!
 * - 'declined_withdrawal': Employee still wants to leave! Resignation accepted -> Offboarding case created.
 */
export async function respondToRetention(
  requestId: string,
  response: 'accepted_withdrawal' | 'declined_withdrawal',
  notes?: string
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  // The retention offer is answered by the employee it was made to, or by
  // P&C recording that answer for them. Nobody else.
  const allowed = await guard('offboarding');
  const self = allowed.ok ? null : await guard('self');
  const ownId = self?.ok ? await currentEmployeeId() : null;
  if (!allowed.ok && !ownId) return { success: false, error: allowed.error };

  initResignationSeedScenarios();
  const req = MEMORY_RESIGNATION_STORE.get(requestId);
  if (!req) return { success: false, error: 'Resignation request not found' };
  if (!allowed.ok && req.employee_id !== ownId) return { success: false, error: allowed.error };

  const nowIso = new Date().toISOString();
  req.employee_retention_response = response;
  req.employee_response_at = nowIso;
  req.employee_response_notes = notes || null;
  req.updated_at = nowIso;

  if (response === 'accepted_withdrawal') {
    // Employee stays! Resignation closed. Employee remains active.
    req.status = 'withdrawn_by_employee';
    req.retention_notes = notes ? `Withdrawal Accepted: ${notes}` : 'Employee agreed to retention proposal and withdrew resignation.';
  } else {
    // Employee declines retention -> Proceed to Exit Initiated!
    req.status = 'resignation_accepted';

    const initRes = await openOffboardingCase({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      employee_email: req.employee_email,
      employee_designation: req.employee_designation,
      employee_department: req.employee_department,
      employee_type: 'Full-Time Employee',
      manager_name: req.manager_name || 'Reporting Manager',
      exit_type: 'resignation',
      initiated_date: req.resignation_date,
      initiated_by: `Employee Declined Retention (Request ${req.id})`,
      proposed_lwd: req.proposed_lwd,
      notice_period_days: req.notice_period_days,
      reason: req.reason,
      reason_details: req.reason_details || undefined,
    });

    if (initRes.success && initRes.caseId) {
      req.offboarding_case_id = initRes.caseId;
    }
  }

  MEMORY_RESIGNATION_STORE.set(requestId, req);

  // Update Supabase if available
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('resignation_requests').update({
      employee_retention_response: req.employee_retention_response,
      employee_response_at: req.employee_response_at,
      employee_response_notes: req.employee_response_notes,
      status: req.status,
      offboarding_case_id: req.offboarding_case_id,
      retention_notes: req.retention_notes,
      updated_at: nowIso,
    }).eq('id', requestId);
  } catch {
    // fallback
  }

  await recordAuditLog('resignation_requests', requestId, 'update', {
    employee_response: response,
    newStatus: req.status,
    notes,
  });

  revalidatePath('/offboarding');
  return { success: true, request: req };
}

/**
 * Resolve Disagreement between Manager and P&C (by Authorized P&C Role).
 */
export async function resolveDisagreement(
  requestId: string,
  resolvedDecision: 'accepted' | 'retention_proposed',
  notes?: string
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  initResignationSeedScenarios();
  const req = MEMORY_RESIGNATION_STORE.get(requestId);
  if (!req) return { success: false, error: 'Resignation request not found' };

  const nowIso = new Date().toISOString();
  req.updated_at = nowIso;
  req.retention_notes = notes || `Disagreement formally resolved by P&C Authority to: ${resolvedDecision.toUpperCase()}`;

  if (resolvedDecision === 'accepted') {
    req.manager_decision = 'accepted';
    req.pnc_decision = 'accepted';
    req.status = 'resignation_accepted';

    const initRes = await openOffboardingCase({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      employee_email: req.employee_email,
      employee_designation: req.employee_designation,
      employee_department: req.employee_department,
      employee_type: 'Full-Time Employee',
      manager_name: req.manager_name || 'Reporting Manager',
      exit_type: 'resignation',
      initiated_date: req.resignation_date,
      initiated_by: `P&C Disagreement Resolution (Request ${req.id})`,
      proposed_lwd: req.proposed_lwd,
      notice_period_days: req.notice_period_days,
      reason: req.reason,
      reason_details: req.reason_details || undefined,
    });

    if (initRes.success && initRes.caseId) {
      req.offboarding_case_id = initRes.caseId;
    }
  } else {
    req.status = 'withdrawal_proposed';
  }

  MEMORY_RESIGNATION_STORE.set(requestId, req);

  // Update Supabase if available
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('resignation_requests').update({
      manager_decision: req.manager_decision,
      pnc_decision: req.pnc_decision,
      status: req.status,
      offboarding_case_id: req.offboarding_case_id,
      retention_notes: req.retention_notes,
      updated_at: nowIso,
    }).eq('id', requestId);
  } catch {
    // fallback
  }

  await recordAuditLog('resignation_requests', requestId, 'update', {
    resolvedDecision,
    newStatus: req.status,
    notes,
  });

  revalidatePath('/offboarding');
  return { success: true, request: req };
}

