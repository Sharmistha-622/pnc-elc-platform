'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import {
  User,
  FileText,
  Briefcase,
  BookOpen,
  FileCheck2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  Eye,
  AlertCircle,
  Send,
  Building,
  Calendar,
  Sparkles,
  Eraser,
  PenTool,
  Clock,
  ShieldCheck,
  FileEdit,
  Loader2,
} from 'lucide-react';
import { PageBanner } from '@/components/shared/page-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FullOnboardingData,
  GENERATED_DOCUMENT_LABELS,
  type GeneratedDocumentType,
  type OnboardingGeneratedDocument,
} from '@/lib/onboarding/types';
import { toast } from 'sonner';
import { PersonalDetailsStep } from './_components/personal-details-step';
import { NoticeStep } from './_components/notice-step';
import { GuardianHold } from './_components/guardian-hold';
import { GUARDIAN_HOLD_MESSAGE } from '@/lib/dpdp/children';
import type { PortalNoticeState, PortalPrivacySettings } from '@/lib/dpdp/portal';
import { DEFAULT_OPTIONAL_FIELDS, normaliseOptionalFields, type OptionalFieldSettings } from '@/lib/dpdp/optional-fields';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.webp';

const STEPS = [
  { id: 0, label: 'Privacy Notice', icon: ShieldCheck },
  { id: 1, label: 'Personal Information', icon: User },
  { id: 2, label: 'Document Dossier', icon: Upload },
  { id: 3, label: 'Employment Terms', icon: Briefcase },
  { id: 4, label: 'Policies & Handbook', icon: BookOpen },
  { id: 5, label: 'Offer & Appointment', icon: FileCheck2 },
  { id: 6, label: 'Final Submission', icon: CheckCircle2 },
];

export default function CandidateOnboardingPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [data, setData] = useState<FullOnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when the link cannot be used: expired, or not recognised.
  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  // Step 0 is the privacy notice: nothing else opens until it is acknowledged.
  const [currentStep, setCurrentStep] = useState(0);
  const [privacy, setPrivacy] = useState<PortalPrivacySettings | null>(null);
  const [notice, setNotice] = useState<PortalNoticeState | null>(null);
  // Under 18: everything after the notice waits for a guardian's consent.
  const [guardianHold, setGuardianHold] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Which optional fields the portal collects (Settings → DPDP & Privacy → Data collection).
  const [optionalFields, setOptionalFields] = useState<OptionalFieldSettings>(DEFAULT_OPTIONAL_FIELDS);

  const [employmentCorrection, setEmploymentCorrection] = useState('');
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);

  // Canvas Signature Pad State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signingDoc, setSigningDoc] = useState<{
    type: GeneratedDocumentType;
    name: string;
    html: string;
  } | null>(null);
  const [signConsent, setSignConsent] = useState(false);
  const [signerFullName, setSignerFullName] = useState('');

  // Policy reading modal
  const [viewingPolicy, setViewingPolicy] = useState<{ title: string; content: string; type: string } | null>(null);

  // Preview doc modal
  const [previewDoc, setPreviewDoc] = useState<{ title: string; html: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/onboarding/token/${token}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        const p = json.data.personalDetails;
        const r = json.data.record;
        setOptionalFields(normaliseOptionalFields(json.privacy?.optional_fields));
        if (json.privacy) {
          const { notice: noticeState, guardian, ...settings } = json.privacy;
          setPrivacy(settings as PortalPrivacySettings);
          setNotice(noticeState as PortalNoticeState);
          const held = guardian === 'required';
          setGuardianHold(held ? GUARDIAN_HOLD_MESSAGE : null);
          setCurrentStep((step) => (noticeState?.acknowledged && !held ? (step === 0 ? 1 : step) : 0));
        }
        setSignerFullName(p?.full_name || r.candidate_name || '');
      } else {
        setLinkProblem(
          json.expired
            ? json.error
            : 'This link is not valid. Use the latest invitation email from the People & Culture team, or ask them for a new one.'
        );
      }
    } catch (err) {
      toast.error('Network error loading candidate portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4f46e5';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirmEmployment = async (confirmed: boolean, notes?: string) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/onboarding/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_employment',
          confirmed,
          correction_requested: !confirmed,
          correction_notes: notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(confirmed ? 'Employment details confirmed!' : 'Correction request submitted to P&C');
        setData(json.data);
        setCorrectionDialogOpen(false);
        if (confirmed) setCurrentStep(4);
      }
    } catch (err) {
      toast.error('Error updating employment confirmation');
    } finally {
      setSaving(false);
    }
  };

  // One hidden file input, retargeted at whichever document the candidate
  // clicked. The portal previously had no file input at all: `handleMockUpload`
  // invented a filename per document type and posted that, so nothing was ever
  // actually collected.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  const promptForFile = (docType: string) => {
    setPendingDocType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const docType = pendingDocType;
    setPendingDocType(null);
    if (!file || !docType) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('That file is larger than 10 MB.');
      return;
    }
    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
      toast.error('Only PDF, JPG, PNG or WebP files are accepted.');
      return;
    }

    const body = new FormData();
    body.append('file', file);
    body.append('document_type', docType);

    try {
      setUploadingDocType(docType);
      const res = await fetch(`/api/onboarding/token/${token}/documents`, { method: 'POST', body });
      const json = await res.json();
      if (json.success) {
        toast.success(`Uploaded ${docType}`);
        setData(json.data);
      } else {
        toast.error(json.error || 'Failed to upload document');
      }
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleTogglePolicy = async (policyType: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/onboarding/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_policy',
          policy_type: policyType,
          status: completed ? 'completed' : 'not_started',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(completed ? 'Policy marked as read' : 'Policy reset');
        setData(json.data);
        if (viewingPolicy) setViewingPolicy(null);
      }
    } catch (err) {
      toast.error('Failed to update policy status');
    }
  };

  const handleSignDocument = async () => {
    if (!signingDoc || !signConsent || !signerFullName.trim()) {
      toast.error('Please confirm consent and enter your full legal name');
      return;
    }

    if (!hasDrawn) {
      toast.error('Please draw your signature in the signature box');
      return;
    }

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null;

    try {
      setSaving(true);
      const res = await fetch(`/api/onboarding/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign_document',
          document_type: signingDoc.type,
          signer_name: signerFullName,
          signature_data_url: signatureDataUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${signingDoc.name} signed.`);
        setData(json.data);
        setSigningDoc(null);
        setSignConsent(false);
        setHasDrawn(false);
      }
    } catch (err) {
      toast.error('Failed to sign document');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitOnboarding = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/onboarding/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_onboarding' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Onboarding submitted to P&C for verification!');
        setData(json.data);
      } else {
        toast.error(json.error || 'Failed to submit onboarding');
      }
    } catch (err) {
      toast.error('Failed to submit onboarding');
    } finally {
      setSaving(false);
    }
  };

  if (linkProblem) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center space-y-2">
          <h1 className="text-base font-semibold">This link can no longer be used</h1>
          <p className="text-sm text-muted-foreground">{linkProblem}</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-sm text-muted-foreground">
        Loading your onboarding portal...
      </div>
    );
  }

  const { record, documents, policies, generatedDocuments, employmentDetails } = data;
  const isSubmitted = ['submitted', 'under_review', 'approved', 'account_provisioning', 'completed'].includes(record.status);

  // Rendered server-side from the template library. The old portal drew two
  // hardcoded cards for the offer and appointment letters only, which is why
  // the Acceptance Letter and the salary annexure had nowhere to appear.
  const letterHtml = (doc: OnboardingGeneratedDocument): string =>
    doc.generated_content?.html || doc.content || '';

  // The annexure states the salary; it is read alongside the offer, not signed
  // separately.
  const signableDocuments = generatedDocuments.filter((d) => d.document_type !== 'annexure');
  const annexureDoc = generatedDocuments.find((d) => d.document_type === 'annexure');
  const allLettersSigned =
    signableDocuments.length === 0 || signableDocuments.every((d) => d.status === 'signed');

  // What is still outstanding, named rather than left for the candidate to
  // guess at from a disabled button.
  const missingRequiredDocs = documents.filter(
    (d) => d.is_required && d.status !== 'uploaded' && d.status !== 'verified'
  );
  const unreadPolicies = policies.filter((p) => p.status !== 'completed');

  const outstanding: string[] = [];
  if (!data.personalDetails?.full_name) outstanding.push('Personal information');
  if (missingRequiredDocs.length > 0) {
    outstanding.push(`${missingRequiredDocs.length} required document(s)`);
  }
  if (!employmentDetails?.candidate_confirmed) outstanding.push('Employment terms confirmation');
  if (unreadPolicies.length > 0) outstanding.push(`${unreadPolicies.length} unread policy document(s)`);
  if (!allLettersSigned) outstanding.push('Letter signatures');

  const canSubmit = outstanding.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* One input serves every document row; `promptForFile` sets the target. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* 1. Standard PageBanner matching application design system */}
      <PageBanner
        title={`Candidate Onboarding — Welcome, ${record.candidate_name}!`}
        description={`Role: ${record.designation} • Team: ${record.team_name || record.department || 'NavGurukul'} • Proposed Joining: ${record.joining_date}`}
        icon={<User className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className="text-xs font-semibold rounded-lg px-2.5 py-1">
              Progress: {record.progress_percentage}%
            </Badge>
          </div>
        }
      />

      {/* Submission Status Alert */}
      {isSubmitted && (
        <div className="p-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 flex items-start gap-3 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm shadow-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Onboarding Submitted Successfully!</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
              Your onboarding dossier has been submitted to the People & Culture (P&C) team. They are currently reviewing your documents and signed letters. Once verified, your official NavGurukul email will be provisioned.
            </p>
          </div>
        </div>
      )}

      {/* Step Navigation Wizard (rounded-lg) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isActive = currentStep === s.id;
          const locked = s.id > 0 && ((!!notice && !notice.acknowledged) || !!guardianHold);

          return (
            <button
              key={s.id}
              type="button"
              disabled={locked}
              title={locked ? (guardianHold ? 'Waiting for your parent or guardian\'s consent' : 'Read the privacy notice first') : undefined}
              onClick={() => setCurrentStep(s.id)}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col items-start gap-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500'
                  : 'border-border/70 hover:bg-muted/30 bg-card'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">0{s.id}</span>
                <Icon className={`size-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />
              </div>
              <span className={`text-xs font-semibold truncate w-full ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {guardianHold && <GuardianHold message={guardianHold} />}

      {/* STEP 0: Privacy notice, before any data field */}
      {currentStep === 0 && privacy && notice && (
        <NoticeStep
          token={token}
          settings={privacy}
          notice={notice}
          onChange={setNotice}
          onContinue={() => { if (!guardianHold) setCurrentStep(1); }}
        />
      )}

      {/* STEP 1: Personal Information */}
      {currentStep === 1 && (
        <PersonalDetailsStep
          token={token}
          data={data}
          optionalFields={optionalFields}
          onSaved={(next, advance) => {
            setData(next);
            if (advance) setCurrentStep(2);
          }}
          onGuardianRequired={(message) => {
            setGuardianHold(message);
            setCurrentStep(0);
          }}
        />
      )}

      {/* STEP 2: Document Upload */}
      {currentStep === 2 && (
        <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Upload className="size-5 text-indigo-700 dark:text-indigo-300" />
                  2. Required Document Dossier
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload verification copies for identity, address, educational degrees, and bank details.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs rounded-lg">
                {documents.filter((d) => ['uploaded', 'verified'].includes(d.status)).length} / {documents.length} Uploaded
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {documents.map((doc) => {
              const isDone = ['uploaded', 'verified'].includes(doc.status);
              const isRejected = doc.status === 'rejected';

              return (
                <div
                  key={doc.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isRejected
                      ? 'border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20'
                      : isDone
                      ? 'border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-border/70 bg-card'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{doc.document_type}</span>
                        {doc.is_required ? (
                          <span className="text-rose-600 dark:text-rose-400 text-sm leading-none" title="Required">*</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">optional</span>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono rounded-lg ${
                            doc.status === 'verified'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : doc.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : doc.status === 'uploaded'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {doc.status}
                        </Badge>
                      </div>

                      {doc.file_name ? (
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          File: {doc.file_name}{doc.file_size ? ` (${doc.file_size})` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          Not uploaded yet — PDF, JPG, PNG or WebP, up to 10&nbsp;MB
                        </p>
                      )}

                      {isRejected && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-100/60 dark:bg-rose-950/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-1.5">
                          <AlertCircle className="size-4 shrink-0 mt-0.5" />
                          <span>
                            <strong>P&C Feedback:</strong> {doc.rejection_reason}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => promptForFile(doc.document_type)}
                        disabled={saving || uploadingDocType !== null}
                        variant={isDone ? 'outline' : 'default'}
                        className={`text-xs h-8 gap-1.5 rounded-lg ${!isDone ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                      >
                        {uploadingDocType === doc.document_type ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="size-3.5" />
                            <span>{isDone ? 'Replace File' : isRejected ? 'Re-Upload File' : 'Upload File'}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)} className="rounded-lg">
              <ChevronLeft className="size-4" />
              <span>Back</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCurrentStep(3)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
            >
              <span>Continue to Employment</span>
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Redesigned Employment Terms & Role Acknowledgment */}
      {currentStep === 3 && (
        <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Briefcase className="size-5 text-indigo-700 dark:text-indigo-300" />
                  3. Employment Terms & Role Acknowledgment
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the core employment parameters proposed by NavGurukul. Please confirm or request corrections.
                </CardDescription>
              </div>
              {employmentDetails?.candidate_confirmed ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs gap-1 py-1 rounded-lg">
                  <CheckCircle2 className="size-3.5" /> Confirmed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 py-1 rounded-lg">
                  Confirmation Required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Metric Tiles Grid (rounded-lg) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Designation */}
              <div className="p-4 rounded-lg border border-border/70 bg-card hover:border-indigo-500/30 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <Briefcase className="size-4 text-indigo-700 dark:text-indigo-300" />
                  <span>Designation</span>
                </div>
                <p className="text-base font-bold text-foreground">{record.designation}</p>
                <span className="text-[11px] text-muted-foreground block">
                  {record.employee_type_name || 'Full-Time Employee'}
                </span>
              </div>

              {/* Department / Team */}
              <div className="p-4 rounded-lg border border-border/70 bg-card hover:border-indigo-500/30 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <Building className="size-4 text-purple-700 dark:text-purple-300" />
                  <span>Department / Team</span>
                </div>
                <p className="text-base font-bold text-foreground">{record.team_name || record.department || 'NavGurukul Core'}</p>
                <span className="text-[11px] text-muted-foreground block">{record.location || 'Bangalore / Hybrid'}</span>
              </div>

              {/* Proposed Joining Date */}
              <div className="p-4 rounded-lg border border-border/70 bg-card hover:border-indigo-500/30 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <Calendar className="size-4 text-teal-700 dark:text-teal-300" />
                  <span>Proposed Joining Date</span>
                </div>
                <p className="text-base font-bold text-foreground">{record.joining_date}</p>
                <span className="text-[11px] text-muted-foreground block">Reporting on day one at campus/workplace</span>
              </div>

              {/* Reporting Manager */}
              <div className="p-4 rounded-lg border border-border/70 bg-card hover:border-indigo-500/30 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <User className="size-4 text-blue-700 dark:text-blue-300" />
                  <span>Reporting Manager</span>
                </div>
                <p className="text-base font-bold text-foreground">{record.manager_name || 'Designated Lead'}</p>
                <span className="text-[11px] text-muted-foreground block">Buddy: {record.buddy_name || 'Assigned Lead'}</span>
              </div>

              {/* Probation Duration */}
              <div className="p-4 rounded-lg border border-border/70 bg-card hover:border-indigo-500/30 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <Clock className="size-4 text-amber-700 dark:text-amber-300" />
                  <span>Probation Duration</span>
                </div>
                <p className="text-base font-bold text-foreground">{record.probation_period || '3 Months'}</p>
                <span className="text-[11px] text-muted-foreground block">Followed by confirmation review</span>
              </div>

              {/* Notice Period */}
              <div className="p-4 rounded-lg border border-border/70 bg-card hover:border-indigo-500/30 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="size-4 text-rose-700 dark:text-rose-300" />
                  <span>Notice Period</span>
                </div>
                <p className="text-base font-bold text-foreground">{record.notice_period || '1 Month'}</p>
                <span className="text-[11px] text-muted-foreground block">Standard separation timeline</span>
              </div>
            </div>

            {/* Roles & Responsibilities Scope */}
            <div className="p-4 rounded-lg border border-border/70 bg-muted/15 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <FileEdit className="size-4 text-indigo-700 dark:text-indigo-300" />
                <span>Roles & Responsibilities Scope:</span>
              </div>
              <blockquote className="border-l-4 border-indigo-600 pl-4 py-1 text-sm text-foreground/90 leading-relaxed italic bg-card/60 rounded-r-lg">
                {record.role_responsibilities ||
                  'Architect and build resilient microservices, maintain web applications for student cohorts, and collaborate on peer-learning platforms.'}
              </blockquote>
            </div>
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)} className="rounded-lg">
              <ChevronLeft className="size-4" />
              <span>Back</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCorrectionDialogOpen(true)}
                className="text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10 rounded-lg"
              >
                Request Correction
              </Button>
              <Button
                size="sm"
                onClick={() => handleConfirmEmployment(true)}
                disabled={saving}
                className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs rounded-lg"
              >
                <CheckCircle2 className="size-4" />
                <span>Confirm & Continue</span>
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: Pre-Joining Policies & Handbook */}
      {currentStep === 4 && (
        <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="size-5 text-indigo-700 dark:text-indigo-300" />
                  4. Pre-Joining Policies & Handbook
                </CardTitle>
                <CardDescription className="text-xs">
                  Please read and acknowledge our foundation mission, code of conduct, leave policies, and security guidelines.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs rounded-lg">
                {policies.filter((p) => p.status === 'completed').length} / {policies.length} Read
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {policies.map((p) => {
              const isCompleted = p.status === 'completed';
              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isCompleted ? 'border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20' : 'border-border/70 bg-card'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{p.title}</span>
                      {isCompleted && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] rounded-lg">Read</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setViewingPolicy({
                          title: p.title,
                          content: p.content || '',
                          type: p.policy_type,
                        })
                      }
                      className="text-xs h-8 gap-1 rounded-lg"
                    >
                      <Eye className="size-3.5" />
                      <span>Read Document</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleTogglePolicy(p.policy_type, !isCompleted)}
                      variant={isCompleted ? 'secondary' : 'default'}
                      className={`text-xs h-8 gap-1 rounded-lg ${!isCompleted ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>{isCompleted ? 'Marked as Read' : 'Mark as Read'}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)} className="rounded-lg">
              <ChevronLeft className="size-4" />
              <span>Back</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCurrentStep(5)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
            >
              <span>Continue to Offer & Appointment</span>
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 5: Offer & Appointment Letter Digital Signing */}
      {currentStep === 5 && (
        <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileCheck2 className="size-5 text-indigo-700 dark:text-indigo-300" />
              5. Offer & Appointment Letter Signature Box
            </CardTitle>
            <CardDescription className="text-xs">
              Review document text and provide your handwritten digital signature in the signature box with metadata audit capture.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {annexureDoc && (
              <div className="p-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-bold text-sm text-foreground">Annexure A — Salary Breakdown</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The detailed split of your compensation, referenced by the letters below.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPreviewDoc({
                        title: `Annexure A — ${record.candidate_name}`,
                        html: letterHtml(annexureDoc),
                      })
                    }
                    className="text-xs h-8 gap-1 rounded-lg shrink-0"
                  >
                    <Eye className="size-3.5" />
                    <span>View Annexure</span>
                  </Button>
                </div>
              </div>
            )}

            {signableDocuments.length === 0 && (
              <div className="p-6 text-center border border-dashed rounded-lg">
                <p className="text-sm font-medium text-foreground">Your letters are being prepared</p>
                <p className="text-xs text-muted-foreground mt-1">
                  People &amp; Culture are finalising them. You can complete the other steps meanwhile.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {signableDocuments.map((doc) => {
                const isSigned = doc.status === 'signed';
                const label = GENERATED_DOCUMENT_LABELS[doc.document_type] || doc.document_name;
                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-lg border border-border/80 bg-card flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-foreground">{label}</span>
                        <Badge
                          className={`text-[10px] rounded-lg ${
                            isSigned
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {isSigned ? 'Signed' : 'Pending Signature'}
                        </Badge>
                      </div>

                      {doc.signed_at && (
                        <div className="space-y-1 pt-2 border-t border-border/40 text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                          <p>✓ Signed by {doc.signed_by}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Timestamp: {new Date(doc.signed_at).toLocaleString('en-IN')}
                          </p>
                          {doc.signature_data_url && (
                            <div className="mt-1 p-2 bg-white dark:bg-muted rounded-lg border border-border/60 inline-block">
                              <img src={doc.signature_data_url} alt="Signature" className="h-8 object-contain" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPreviewDoc({ title: `${label} — ${record.candidate_name}`, html: letterHtml(doc) })
                        }
                        className="text-xs h-8 gap-1 flex-1 rounded-lg"
                      >
                        <Eye className="size-3.5" />
                        <span>Preview</span>
                      </Button>
                      {!isSigned && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSigningDoc({ type: doc.document_type, name: label, html: letterHtml(doc) });
                            setTimeout(clearCanvas, 100);
                          }}
                          className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex-1 rounded-lg"
                        >
                          <PenTool className="size-3.5" />
                          <span>Sign</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(4)} className="rounded-lg">
              <ChevronLeft className="size-4" />
              <span>Back</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCurrentStep(6)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
            >
              <span>Continue to Submission</span>
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 6: Completion & Submit to P&C */}
      {currentStep === 6 && (
        <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="size-5 text-indigo-700 dark:text-indigo-300" />
              6. Onboarding Completion & Final Submission
            </CardTitle>
            <CardDescription className="text-xs">
              Review your completed dossier checklist before submitting to the People & Culture team.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 overflow-hidden bg-muted/10 text-xs">
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-semibold text-foreground">1. Personal & Contact Information</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 rounded-lg">Complete</Badge>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-semibold text-foreground">2. Required Verification Documents</span>
                <span className="font-mono text-muted-foreground font-semibold">
                  {documents.filter((d) => ['uploaded', 'verified'].includes(d.status)).length} Uploaded
                </span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-semibold text-foreground">3. Employment Terms Confirmation</span>
                {employmentDetails?.candidate_confirmed ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 rounded-lg">Confirmed</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 dark:text-amber-300 rounded-lg">Pending</Badge>
                )}
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-semibold text-foreground">4. Pre-Joining Policies & Handbook</span>
                <span className="font-mono text-muted-foreground font-semibold">
                  {policies.filter((p) => p.status === 'completed').length} / {policies.length} Read
                </span>
              </div>
              {signableDocuments.map((doc, index) => (
                <div key={doc.id} className="p-3.5 flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {5 + index}. {GENERATED_DOCUMENT_LABELS[doc.document_type] || doc.document_name}
                  </span>
                  {doc.status === 'signed' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 rounded-lg">Signed with Metadata</Badge>
                  ) : (
                    <Badge variant="outline" className="text-rose-700 dark:text-rose-300 rounded-lg">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(5)} className="rounded-lg">
              <ChevronLeft className="size-4" />
              <span>Back</span>
            </Button>

            {!isSubmitted ? (
              <div className="flex flex-col items-end gap-1.5">
                <Button
                  size="sm"
                  onClick={handleSubmitOnboarding}
                  disabled={saving || !canSubmit}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-sm rounded-lg"
                >
                  <Send className="size-4" />
                  <span>Submit Onboarding to P&C</span>
                </Button>
                {!canSubmit && (
                  <p className="text-[11px] text-muted-foreground text-right max-w-xs">
                    {outstanding.join(' · ')}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
                <span>Submitted on {record.submitted_at ? new Date(record.submitted_at).toLocaleDateString('en-IN') : 'Today'}</span>
              </div>
            )}
          </CardFooter>
        </Card>
      )}

      {/* 90vw / 90vh MODAL: Digital Signature Box with Canvas & Metadata Capture */}
      <Dialog open={!!signingDoc} onOpenChange={() => setSigningDoc(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-lg border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <PenTool className="size-5 text-indigo-700 dark:text-indigo-300" />
                Sign {signingDoc?.name} — Signature Box & Audit Capture
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                Legally Binding Digital Sign
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Draw your signature in the designated pad below. Metadata including timestamp, signer identity, and browser fingerprint will be cryptographically captured.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* Document Content View */}
            <div className="p-4 rounded-lg border border-border bg-card max-h-56 overflow-y-auto text-xs shadow-inner">
              <div
                className="prose dark:prose-invert max-w-none text-xs"
                dangerouslySetInnerHTML={{ __html: signingDoc?.html || '' }}
              />
            </div>

            {/* Interactive Signature Box & Metadata Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Signature Canvas Box */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <PenTool className="size-3.5 text-indigo-700 dark:text-indigo-300" />
                    <span>Draw Your Signature in the Box Below:</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearCanvas}
                    className="h-7 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 gap-1 rounded-lg"
                  >
                    <Eraser className="size-3.5" />
                    <span>Clear Signature</span>
                  </Button>
                </div>

                <div className="relative border-2 border-dashed border-indigo-400/80 rounded-lg bg-muted/30 p-2 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-40 bg-transparent cursor-crosshair touch-none"
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/60 text-xs">
                      <PenTool className="size-6 mb-1 opacity-40" />
                      <span>Draw signature using mouse, trackpad, or finger</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-3 text-[10px] font-mono text-muted-foreground pointer-events-none">
                    [Sign Box]
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Signer Legal Full Name</Label>
                  <Input
                    placeholder="Type full legal name..."
                    value={signerFullName}
                    onChange={(e) => setSignerFullName(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>

              {/* Metadata Audit Capture Panel */}
              <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-2">
                    <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-300" />
                    <span>Captured Signature Metadata Audit Trail</span>
                  </div>
                  <div className="space-y-2 text-[11px] font-mono text-muted-foreground divide-y divide-border/40">
                    <div className="flex justify-between pt-1">
                      <span>Capture Method:</span>
                      <span className="text-foreground">HTML5 Canvas Direct Stroke</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Timestamp (UTC):</span>
                      <span className="text-foreground">{new Date().toISOString()}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Signer Role:</span>
                      <span className="text-foreground">Candidate ({record.designation})</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Network address:</span>
                      <span className="text-foreground">Recorded when you sign</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-[11px] text-indigo-900 dark:text-indigo-200">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={signConsent}
                      onChange={(e) => setSignConsent(e.target.checked)}
                      className="size-4 mt-0.5 rounded text-indigo-700 dark:text-indigo-300 cursor-pointer"
                    />
                    <span className="leading-tight font-medium">
                      I confirm that I have reviewed the complete text of this document and intend to execute it with this digital signature.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setSigningDoc(null)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSignDocument}
              disabled={saving || !signConsent || !signerFullName.trim() || !hasDrawn}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 rounded-lg"
            >
              <CheckCircle2 className="size-4" />
              <span>Confirm & Affix Signature</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 90vw / 90vh MODAL: Read Policy Dialog */}
      <Dialog open={!!viewingPolicy} onOpenChange={() => setViewingPolicy(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-lg border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="size-5 text-indigo-700 dark:text-indigo-300" />
              {viewingPolicy?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-line">
              {viewingPolicy?.content}
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0 flex justify-between">
            <Button size="sm" variant="outline" onClick={() => setViewingPolicy(null)} className="rounded-lg">
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => viewingPolicy && handleTogglePolicy(viewingPolicy.type, true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg"
            >
              Mark as Read & Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 90vw / 90vh MODAL: Document HTML Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-lg border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="size-5 text-indigo-700 dark:text-indigo-300" />
              {previewDoc?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto">
            <div
              className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: previewDoc?.html || '' }}
            />
          </div>
          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setPreviewDoc(null)} className="rounded-lg">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 90vw / 90vh MODAL: Request Correction Modal */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-lg border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="size-5" />
              Request Employment Details Correction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              State any discrepancies in designation, joining date, compensation, or reporting structure clearly for the P&C team.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200">
              Please note: Submitting a correction request flags the record for P&C review. Your onboarding will remain active while adjustments are evaluated.
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Describe Discrepancy / Desired Adjustment</Label>
              <Textarea
                rows={8}
                placeholder="e.g. My proposed joining date needs to be updated to 15th October due to prior employment notice period..."
                value={employmentCorrection}
                onChange={(e) => setEmploymentCorrection(e.target.value)}
                className="text-sm rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setCorrectionDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleConfirmEmployment(false, employmentCorrection)}
              disabled={saving || !employmentCorrection.trim()}
              className="bg-amber-700 hover:bg-amber-800 text-white rounded-lg"
            >
              Submit Request to P&C
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
