'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Sparkles,
  Send,
  Eye,
  Check,
  History,
  FileX2,
  Layers,
  MapPin,
  HeartHandshake,
  Briefcase,
  BookOpen,
  Award,
  Globe,
  Radio,
  Loader2,
  IndianRupee,
} from 'lucide-react';
import { AnnexureTable } from '@/components/onboarding/annexure-table';
import { PageBanner } from '@/components/shared/page-banner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { displayMaskedNumber } from '@/lib/vault/sealing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FullOnboardingData, OnboardingStatus } from '@/lib/onboarding/types';
import { toast } from 'sonner';

export default function OnboardingReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [data, setData] = useState<FullOnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');

  // Document Rejection Dialog State
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Document Preview Dialog State
  const [previewDoc, setPreviewDoc] = useState<{ title: string; html: string } | null>(null);

  // Opening a candidate document fetches a short-lived signed URL rather than
  // rendering a placeholder: the bucket is private, so identity and bank proofs
  // are never reachable from a guessable address.
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const openStoredDocument = async (documentId: string) => {
    try {
      setOpeningDocId(documentId);
      const res = await fetch(`/api/onboarding/${data?.record.id}/documents/${documentId}/url`);
      const json = await res.json();
      if (json.success && json.url) {
        window.open(json.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(json.error || 'Could not open that document.');
      }
    } catch {
      toast.error('Could not open that document.');
    } finally {
      setOpeningDocId(null);
    }
  };

  // Provisioning Dialog State
  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/onboarding/${token}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        toast.error('Could not find candidate onboarding record');
      }
    } catch (err) {
      toast.error('Network error loading onboarding review');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSendInvitation = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/onboarding/${data.record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_invitation' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Invitation sent to ${data.record.personal_email}`);
        fetchData();
      }
    } catch (err) {
      toast.error('Error sending invitation');
    } finally {
      setActionLoading(false);
    }
  };

  // Verifying a document is also what moves it out of core, so the number is
  // captured in the same step. It is sent straight through to the vault — core
  // keeps only the last four characters.
  const [verifyingDoc, setVerifyingDoc] = useState<{ id: string; type: string } | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');

  const handleVerifyDocument = async () => {
    if (!data || !verifyingDoc) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/onboarding/${data.record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_document',
          document_id: verifyingDoc.id,
          status: 'verified',
          document_number: documentNumber.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const sealed = json.data?.documents?.find(
          (d: { id: string }) => d.id === verifyingDoc.id
        );
        if (sealed?.seal_state === 'sealed') {
          toast.success(`${verifyingDoc.type} verified and secured in the vault`);
        } else {
          // Verified but still in core. Not a success worth a green toast.
          toast.warning(
            `${verifyingDoc.type} is verified but could not be moved to the vault yet. It stays in the exposure list until it is.`
          );
        }
        setVerifyingDoc(null);
        setDocumentNumber('');
        fetchData();
      } else {
        toast.error(json.error || 'Could not verify that document');
      }
    } catch {
      toast.error('Could not verify that document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrySeal = async (docId: string) => {
    if (!data) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/onboarding/${data.record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_seal', document_id: docId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Retried moving the document to the vault');
        fetchData();
      } else {
        toast.error(json.error || 'Retry failed');
      }
    } catch {
      toast.error('Retry failed');
    } finally {
      setActionLoading(false);
    }
  };


  const handleRejectDocument = async () => {
    if (!data || !selectedDocId || !rejectionReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/onboarding/${data.record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_document',
          document_id: selectedDocId,
          status: 'rejected',
          rejection_reason: rejectionReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.warning('Document marked as rejected');
        setRejectDialogOpen(false);
        setRejectionReason('');
        setSelectedDocId(null);
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to reject document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: OnboardingStatus, note?: string) => {
    if (!data) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/onboarding/${data.record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          status: newStatus,
          note,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Onboarding status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProvisionAccount = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/onboarding/${data.record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision_account' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Official account provisioned and employee record created.');
        setProvisionDialogOpen(false);
        fetchData();
      } else {
        // Provisioning refuses while a required document is unverified, and the
        // reason names which ones. Showing it is the whole point.
        toast.error(json.error || 'Failed to provision account');
      }
    } catch (err) {
      toast.error('Failed to provision account');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground text-sm font-medium">
        Loading candidate onboarding review dossier...
      </div>
    );
  }

  const { record, personalDetails, employmentDetails, documents, policies, generatedDocuments, activityLogs, provisioning, salaryStructure } = data;

  const offerDoc = generatedDocuments.find((d) => d.document_type === 'offer_letter');
  const apptDoc = generatedDocuments.find((d) => d.document_type === 'appointment_letter');

  const isPersonalComplete = !!personalDetails?.full_name && !!personalDetails?.permanent_address;
  const isEmploymentConfirmed = !!employmentDetails?.candidate_confirmed;
  const verifiedDocsCount = documents.filter((d) => d.status === 'verified').length;
  const totalUploadedDocs = documents.filter((d) => ['uploaded', 'verified'].includes(d.status)).length;
  const arePoliciesComplete = policies.filter((p) => p.status === 'completed').length >= 4;
  const isOfferSigned = offerDoc?.status === 'signed';
  const isApptSigned = apptDoc?.status === 'signed';

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Top Breadcrumb & Return */}
      <div className="flex items-center justify-between">
        <Link
          href="/onboarding/candidate"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Candidate Onboardings</span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>Token:</span>
          <code className="px-2 py-0.5 rounded bg-muted text-foreground font-bold">{record.invitation_token}</code>
        </div>
      </div>

      {/* Header PageBanner */}
      <PageBanner
        title={record.candidate_name}
        description={
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-muted-foreground mt-1">
            <span className="font-bold text-foreground">{record.designation}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Building className="size-3.5" />
              {record.team_name || record.department || 'NavGurukul'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <Mail className="size-3.5" />
              {record.personal_email}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              Joining: {record.joining_date}
            </span>
            {record.is_alumni && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 rounded">
                  Alumni
                </Badge>
              </>
            )}
          </div>
        }
        icon={<User className="size-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Candidate Link Button */}
            <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs rounded-lg font-semibold shadow-xs">
              <Link href={`/onboarding/${record.invitation_token}`} target="_blank" rel="noreferrer">
                <span>Candidate Form</span>
                <ExternalLink className="size-3.5 text-indigo-700 dark:text-indigo-300" />
              </Link>
            </Button>

            {/* Resend / Send Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendInvitation}
              disabled={actionLoading}
              className="gap-1.5 text-xs rounded-lg font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border-blue-200 dark:border-blue-900"
            >
              <Send className="size-3.5" />
              <span>{record.status === 'draft' ? 'Send Invitation' : 'Resend Link'}</span>
            </Button>

            {/* Status Workflow Action Buttons */}
            {['submitted', 'under_review'].includes(record.status) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate('changes_requested', 'P&C requested candidate to update specific details or re-upload documents.')}
                  disabled={actionLoading}
                  className="gap-1.5 text-xs text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/10 rounded-lg font-semibold"
                >
                  <AlertCircle className="size-3.5" />
                  <span>Request Changes</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('approved', 'P&C verified all documents and approved the onboarding dossier.')}
                  disabled={actionLoading}
                  className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Approve Dossier</span>
                </Button>
              </>
            )}

            {record.status === 'approved' && (
              <Button
                size="sm"
                onClick={() => setProvisionDialogOpen(true)}
                disabled={actionLoading}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-md animate-pulse"
              >
                <Sparkles className="size-3.5" />
                <span>Create Official Account</span>
              </Button>
            )}

            {record.status === 'completed' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="size-4" />
                <span>Official Account Active ({provisioning?.official_email || 'Provisioned'})</span>
              </div>
            )}
          </div>
        }
      />

      {/* Candidate Portal Visit Status Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-card/60 backdrop-blur-md border border-border text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Lifecycle Status:</span>
            <Badge variant="outline" className="font-semibold text-xs capitalize px-2 py-0.5 rounded-md bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
              {record.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Dossier Progress:</span>
            <span className="font-bold font-mono text-foreground">{record.progress_percentage}%</span>
          </div>
        </div>

        {/* Visits Metadata */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Globe className="size-3.5 text-indigo-700 dark:text-indigo-300" />
            <span>Portal Visits: <strong className="text-foreground">{record.visit_count || 0}</strong></span>
          </div>
          {record.first_visited_at && (
            <div className="flex items-center gap-1.5">
              <span>First Visit: <strong className="text-foreground">{new Date(record.first_visited_at).toLocaleString('en-IN')}</strong></span>
            </div>
          )}
          {record.last_visited_at && (
            <div className="flex items-center gap-1.5">
              <span>Last Active: <strong className="text-foreground">{new Date(record.last_visited_at).toLocaleString('en-IN')}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Redesigned Modern Navigation Tabs (Single-line horizontally scrollable) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto overflow-y-hidden p-1.5 rounded-xl border border-border bg-card/60 backdrop-blur-md shadow-xs">
          <TabsList className="bg-transparent h-auto p-0 flex flex-nowrap items-center gap-1.5 justify-start w-max min-w-full">
            <TabsTrigger
              value="personal"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <User className="size-3.5" />
              <span>Personal Details</span>
            </TabsTrigger>
            <TabsTrigger
              value="employment"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <Briefcase className="size-3.5" />
              <span>Employment & Terms</span>
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <FileText className="size-3.5" />
              <span>Verification ({verifiedDocsCount}/{documents.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="policies"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <BookOpen className="size-3.5" />
              <span>Pre-Joining Policies</span>
            </TabsTrigger>
            <TabsTrigger
              value="letters"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <Award className="size-3.5" />
              <span>Letters & Annexure</span>
            </TabsTrigger>
            <TabsTrigger
              value="review"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Final Review</span>
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-3.5 py-2 text-xs font-semibold gap-1.5 transition-all text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              <History className="size-3.5" />
              <span>Audit & Visits ({activityLogs.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB: Personal Details (Aligned with candidate form, preferred_name removed) */}
        <TabsContent value="personal" className="space-y-6 animate-in fade-in duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="size-5 text-indigo-600 dark:text-indigo-400" />
                Personal, Address & Emergency Contact Dossier
              </CardTitle>
              <CardDescription className="text-xs">
                Candidate-submitted personal information, residential addresses, and verified emergency contact person.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Full Legal Name</p>
                <p className="text-sm font-semibold text-foreground">{personalDetails?.full_name || record.candidate_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date of Birth</p>
                <p className="text-sm font-medium text-foreground font-mono">{personalDetails?.date_of_birth || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Gender</p>
                <p className="text-sm font-medium text-foreground">{personalDetails?.gender || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Blood Group</p>
                <p className="text-sm font-medium text-foreground font-mono">{personalDetails?.blood_group || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Personal Email</p>
                <p className="text-sm font-medium text-foreground font-mono">{personalDetails?.personal_email || record.personal_email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mobile Number</p>
                <p className="text-sm font-medium text-foreground font-mono">{personalDetails?.phone || record.phone || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">NavGurukul Alumni?</p>
                <p className="text-sm font-medium text-foreground">
                  {personalDetails?.is_alumni || record.is_alumni ? 'Yes (NavGurukul Alumni)' : 'No'}
                </p>
              </div>

              {/* Permanent Address */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground uppercase tracking-wider">
                  <MapPin className="size-4 text-indigo-700 dark:text-indigo-300" />
                  <span>Permanent Address (As per ID proof)</span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                  {personalDetails?.permanent_address ? (
                    `${personalDetails.permanent_address}${personalDetails.city ? `, ${personalDetails.city}` : ''}${personalDetails.state ? `, ${personalDetails.state}` : ''}${personalDetails.pincode ? ` - ${personalDetails.pincode}` : ''}`
                  ) : (
                    '—'
                  )}
                </p>
              </div>

              {/* Current Address */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground uppercase tracking-wider">
                  <MapPin className="size-4 text-purple-700 dark:text-purple-300" />
                  <span>Current Residential Accommodation</span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                  {personalDetails?.current_address ? (
                    `${personalDetails.current_address}${personalDetails.city ? `, ${personalDetails.city}` : ''}${personalDetails.state ? `, ${personalDetails.state}` : ''}${personalDetails.pincode ? ` - ${personalDetails.pincode}` : ''}`
                  ) : (
                    'Same as permanent address'
                  )}
                </p>
              </div>

              {/* Emergency Contact Dossier */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 rounded-xl border border-rose-200/60 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                  <HeartHandshake className="size-4 text-rose-700 dark:text-rose-300" />
                  <span>Emergency Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Contact Person</p>
                    <p className="text-sm font-semibold text-foreground">{personalDetails?.emergency_contact_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Relationship</p>
                    <p className="text-sm font-medium text-foreground">{personalDetails?.emergency_contact_relation || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Emergency Mobile</p>
                    <p className="text-sm font-medium text-foreground font-mono">{personalDetails?.emergency_contact_phone || '—'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Employment Terms */}
        <TabsContent value="employment" className="space-y-6 animate-in fade-in duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Briefcase className="size-5 text-indigo-600 dark:text-indigo-400" />
                    Employment Parameters & Terms
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Contractual terms, compensation, probation duration, campus location, and candidate confirmation.
                  </CardDescription>
                </div>
                {employmentDetails?.candidate_confirmed ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs gap-1.5 px-2.5 py-1">
                    <CheckCircle2 className="size-3.5" />
                    Confirmed by Candidate
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 px-2.5 py-1">
                    Pending Candidate Confirmation
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Role / Designation</p>
                <p className="text-sm font-bold text-foreground">{record.designation}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Department / Team</p>
                <p className="text-sm font-medium text-foreground">{record.team_name || record.department || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Work Location / Campus</p>
                <p className="text-sm font-medium text-foreground">{record.location || 'Bangalore Campus'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reporting Manager</p>
                <p className="text-sm font-medium text-foreground">{record.manager_name || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Onboarding Buddy</p>
                <p className="text-sm font-medium text-foreground">{record.buddy_name || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Proposed Joining Date</p>
                <p className="text-sm font-medium text-foreground font-mono">{record.joining_date}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Engagement Type</p>
                <p className="text-sm font-medium text-foreground">{record.employee_type_name || 'Full-Time Employee'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Probation Duration</p>
                <p className="text-sm font-medium text-foreground">{record.probation_period || '3 Months'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Notice Period</p>
                <p className="text-sm font-medium text-foreground">{record.notice_period || '1 Month'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Annual CTC / Compensation</p>
                <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono">{record.ctc || '—'}</p>
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Role & Responsibilities Scope</p>
                <p className="text-xs text-foreground/90 bg-muted/20 p-3.5 rounded-xl border border-border/60 leading-relaxed">
                  {record.role_responsibilities || 'Standard duties as per NavGurukul team specifications.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Document Verification Console */}
        <TabsContent value="documents" className="space-y-6 animate-in fade-in duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="size-5 text-indigo-600 dark:text-indigo-400" />
                    Candidate Document Verification Console
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect uploaded proofs, mark as Verified, or Reject with actionable feedback for candidate re-upload.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono px-2.5 py-1 rounded-lg">
                  {verifiedDocsCount} / {documents.length} Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {documents.map((doc) => {
                  const isUploaded = ['uploaded', 'verified', 'rejected'].includes(doc.status);
                  return (
                    <div key={doc.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${
                            doc.status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/50'
                              : doc.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 dark:text-rose-300 dark:bg-rose-950/50'
                              : doc.status === 'uploaded'
                              ? 'bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-950/50'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <FileText className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-foreground">{doc.document_type}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
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
                          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-1">
                            {doc.seal_state === 'sealed' ? (
                              // The residue: enough to show it is done and to
                              // tell two documents apart. The file is gone.
                              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                                <ShieldCheck className="size-3.5" />
                                Secured in vault
                                {doc.document_number_last4 && (
                                  <span className="font-mono text-muted-foreground">
                                    · {displayMaskedNumber(doc.document_type_key || '', doc.document_number_last4)}
                                  </span>
                                )}
                              </span>
                            ) : doc.file_name ? (
                              <span className="font-mono">{doc.file_name}{doc.file_size ? ` (${doc.file_size})` : ''}</span>
                            ) : (
                              <span className="italic text-muted-foreground">Pending upload by candidate</span>
                            )}
                            {doc.verified_by && <span>• Verified by {doc.verified_by}</span>}
                          </div>

                          {doc.seal_state === 'seal_failed' && (
                            // Verified, but still sitting in core. Worse than
                            // staged: nobody is waiting on it any more.
                            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                              <div className="space-y-1.5">
                                <p>
                                  <strong>Still in core.</strong> This document is verified but
                                  could not be moved to the vault: {doc.seal_error}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRetrySeal(doc.id)}
                                  disabled={actionLoading}
                                  className="h-7 text-[11px] rounded-lg"
                                >
                                  Retry
                                </Button>
                              </div>
                            </div>
                          )}

                          {doc.rejection_reason && (
                            <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                              <span><strong>Rejection Reason:</strong> {doc.rejection_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Document Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isUploaded && doc.storage_reference && doc.seal_state !== 'sealed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openStoredDocument(doc.id)}
                            disabled={openingDocId === doc.id}
                            className="text-xs h-8 gap-1 rounded-lg"
                          >
                            {openingDocId === doc.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                            <span>Open</span>
                          </Button>
                        )}

                        {isUploaded && doc.status !== 'verified' && doc.seal_state !== 'sealed' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setDocumentNumber('');
                              setVerifyingDoc({ id: doc.id, type: doc.document_type });
                            }}
                            disabled={actionLoading}
                            className="text-xs h-8 gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg"
                          >
                            <Check className="size-3.5" />
                            <span>Verify</span>
                          </Button>
                        )}

                        {isUploaded && doc.status !== 'rejected' && doc.seal_state !== 'sealed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDocId(doc.id);
                              setRejectDialogOpen(true);
                            }}
                            disabled={actionLoading}
                            className="text-xs h-8 gap-1 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/10 rounded-lg"
                          >
                            <FileX2 className="size-3.5" />
                            <span>Reject</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Pre-Joining Policies */}
        <TabsContent value="policies" className="space-y-6 animate-in fade-in duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="size-5 text-indigo-600 dark:text-indigo-400" />
                Pre-Joining Policies & Code of Conduct
              </CardTitle>
              <CardDescription className="text-xs">
                Candidate handbook reading and digital acknowledgment tracker.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {policies.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-border/70 bg-muted/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-foreground">{p.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] rounded ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30'
                        }`}
                      >
                        {p.status === 'completed' ? 'Completed' : 'Not Started'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    {p.completed_at && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                        Acknowledged on {new Date(p.completed_at).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPreviewDoc({
                        title: p.title,
                        html: `<div class="p-6 text-sm leading-relaxed space-y-4 text-foreground/90 whitespace-pre-line">${p.content}</div>`,
                      })
                    }
                    className="text-xs h-8 gap-1 shrink-0 rounded-lg"
                  >
                    <Eye className="size-3.5" />
                    <span>View Policy</span>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: Offer & Appointment Letters */}
        <TabsContent value="letters" className="space-y-6 animate-in fade-in duration-200">
          {/* Annexure A — the salary split the letters quote. Derived from the
              agreed CTC and stored, so the letters and the annexure can never
              disagree about the same figure. */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <IndianRupee className="size-5 text-indigo-700 dark:text-indigo-300" />
                <CardTitle className="text-base font-bold">Annexure A — Salary Breakdown</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Derived from the agreed CTC using the rule for this employee type.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              {salaryStructure ? (
                <AnnexureTable
                  structure={salaryStructure}
                  employeeName={record.candidate_name}
                  designation={record.designation}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No salary structure yet. Add a compensation figure to the candidate record and
                  regenerate the documents to produce the annexure.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Offer Letter Card */}
            <Card className="rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between">
              <CardHeader className="pb-4 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="size-5 text-indigo-700 dark:text-indigo-300" />
                    <CardTitle className="text-base font-bold">Offer Letter</CardTitle>
                  </div>
                  <Badge
                    className={`text-xs ${
                      offerDoc?.status === 'signed'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {offerDoc?.status === 'signed' ? 'Signed & Accepted' : 'Generated (Unsigned)'}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Official offer of employment specifying CTC, probation, and position details.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 text-xs space-y-2 text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Document Status:</span>
                  <span className="font-semibold text-foreground capitalize">{offerDoc?.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Signed At:</span>
                  <span className="font-mono text-foreground">{offerDoc?.signed_at ? new Date(offerDoc.signed_at).toLocaleString('en-IN') : 'Pending signature'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Signer Name:</span>
                  <span className="font-semibold text-foreground">{offerDoc?.signed_by || '—'}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-border/40 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewDoc({
                      title: 'Offer Letter — ' + record.candidate_name,
                      html: offerDoc?.generated_content?.contentHtml || '<p>Offer letter content</p>',
                    })
                  }
                  className="text-xs h-8 gap-1.5 rounded-lg"
                >
                  <Eye className="size-3.5" />
                  <span>Preview Document</span>
                </Button>
              </CardFooter>
            </Card>

            {/* Appointment Letter Card */}
            <Card className="rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between">
              <CardHeader className="pb-4 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="size-5 text-indigo-700 dark:text-indigo-300" />
                    <CardTitle className="text-base font-bold">Appointment Letter</CardTitle>
                  </div>
                  <Badge
                    className={`text-xs ${
                      apptDoc?.status === 'signed'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {apptDoc?.status === 'signed' ? 'Signed & Accepted' : 'Generated (Unsigned)'}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Formal appointment letter with governance clauses and joining terms.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 text-xs space-y-2 text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Document Status:</span>
                  <span className="font-semibold text-foreground capitalize">{apptDoc?.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Signed At:</span>
                  <span className="font-mono text-foreground">{apptDoc?.signed_at ? new Date(apptDoc.signed_at).toLocaleString('en-IN') : 'Pending signature'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Signer Name:</span>
                  <span className="font-semibold text-foreground">{apptDoc?.signed_by || '—'}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-border/40 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewDoc({
                      title: 'Appointment Letter — ' + record.candidate_name,
                      html: apptDoc?.generated_content?.contentHtml || '<p>Appointment letter content</p>',
                    })
                  }
                  className="text-xs h-8 gap-1.5 rounded-lg"
                >
                  <Eye className="size-3.5" />
                  <span>Preview Document</span>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 7: Final Review & Quality Gate */}
        <TabsContent value="review" className="space-y-6 animate-in fade-in duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="size-5 text-indigo-600 dark:text-indigo-400" />
                P&C Final Onboarding Review & Sign-Off Gate
              </CardTitle>
              <CardDescription className="text-xs">
                Checklist of all 6 candidate milestones before approving onboarding and provisioning organizational credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Identity */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">1. Personal & Contact Dossier</span>
                    {isPersonalComplete ? (
                      <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPersonalComplete ? 'Complete & verified' : 'Incomplete submission'}
                  </p>
                </div>

                {/* 2. Employment */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">2. Employment Terms</span>
                    {isEmploymentConfirmed ? (
                      <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isEmploymentConfirmed ? 'Confirmed by candidate' : 'Pending confirmation'}
                  </p>
                </div>

                {/* 3. Documents */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">3. Document Dossier</span>
                    {verifiedDocsCount >= 3 ? (
                      <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verifiedDocsCount} verified of {documents.length}
                  </p>
                </div>

                {/* 4. Policies */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">4. Pre-Joining Policies</span>
                    {arePoliciesComplete ? (
                      <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {policies.filter((p) => p.status === 'completed').length} / {policies.length} Read
                  </p>
                </div>

                {/* 5. Offer Letter */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">5. Offer Letter</span>
                    {isOfferSigned ? (
                      <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isOfferSigned ? 'Accepted & Signed' : 'Pending signature'}
                  </p>
                </div>

                {/* 6. Appointment Letter */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">6. Appointment Letter</span>
                    {isApptSigned ? (
                      <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isApptSigned ? 'Accepted & Signed' : 'Pending signature'}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Current Lifecycle State: <span className="font-bold text-foreground capitalize">{record.status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                {record.status !== 'completed' && record.status !== 'approved' && (
                  <Button
                    onClick={() => handleStatusUpdate('approved', 'P&C completed final review and approved onboarding dossier.')}
                    disabled={actionLoading}
                    className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-sm"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>Approve Onboarding Dossier</span>
                  </Button>
                )}
                {record.status === 'approved' && (
                  <Button
                    onClick={() => setProvisionDialogOpen(true)}
                    disabled={actionLoading}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-md"
                  >
                    <Sparkles className="size-4" />
                    <span>Proceed to Account Provisioning</span>
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* TAB 8: Lifecycle Activity & Audit Trail (With all visits data) */}
        <TabsContent value="audit" className="space-y-6 animate-in fade-in duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <History className="size-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-base font-bold">Lifecycle Activity & Audit Trail</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Chronological immutable timeline capturing candidate portal visits, edits, uploads, letter signings, and P&C actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {activityLogs.map((log) => {
                  const isVisit = log.action.includes('Portal');
                  const isPnc = log.actor_type === 'pnc';
                  const isSystem = log.actor_type === 'system';

                  return (
                    <div key={log.id} className="relative group">
                      <div
                        className={`absolute -left-6 top-1.5 size-3 rounded-full ring-4 ring-card ${
                          isVisit
                            ? 'bg-blue-500'
                            : isPnc
                            ? 'bg-indigo-600'
                            : isSystem
                            ? 'bg-purple-600'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-foreground">{log.action}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase px-1.5 py-0 font-mono ${
                              isVisit
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-500/30'
                                : isPnc
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-500/30'
                                : isSystem
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-500/30'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {log.actor_type}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {new Date(log.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{log.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Document Reason Dialog */}
      {/* Verify a document, and capture its number in the same step. */}
      <Dialog
        open={Boolean(verifyingDoc)}
        onOpenChange={(open) => {
          if (!open) {
            setVerifyingDoc(null);
            setDocumentNumber('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Verify {verifyingDoc?.type}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verifying moves this document into the vault and removes it from here. That
              cannot be undone from this screen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="document-number" className="text-xs font-medium">
              Document number <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="document-number"
              value={documentNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDocumentNumber(e.target.value)}
              placeholder="As printed on the document"
              className="h-9 text-xs rounded-lg font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Stored in the vault. Only the last four characters stay here, so nobody
              working in this app can read the whole number back.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVerifyingDoc(null)}
              className="rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleVerifyDocument}
              disabled={actionLoading}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs gap-1.5"
            >
              {actionLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              <span>Verify and secure</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertCircle className="size-5" />
              Reject Candidate Document
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              State the reason for rejection clearly. The candidate will see this feedback in their portal and be requested to upload a corrected copy.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 text-xs text-rose-800 dark:text-rose-200">
              Please note: Rejecting a document will update the document status to <strong>Rejected</strong> and alert the candidate to re-upload.
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejection_reason" className="text-xs font-semibold">
                Rejection Feedback / Notes <span className="text-rose-700 dark:text-rose-300">*</span>
              </Label>
              <Textarea
                id="rejection_reason"
                rows={8}
                placeholder="e.g. The address proof is blurry and older than 3 months. Please upload a recent electricity bill or rental agreement."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="text-sm rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRejectDocument}
              disabled={actionLoading || !rejectionReason.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document HTML Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="size-5 text-indigo-700 dark:text-indigo-300" />
              {previewDoc?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto">
            <div
              className="prose dark:prose-invert max-w-none text-xs"
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

      {/* Official Account Provisioning Dialog */}
      <Dialog open={provisionDialogOpen} onOpenChange={setProvisionDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh] rounded-2xl border border-border shadow-2xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-md">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Sparkles className="size-5" />
              Provision Official NavGurukul Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              This action generates the official Google Workspace email, allocates the employee ID code, and triggers credential dispatch to candidate personal email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs">
            <div className="p-5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 space-y-3">
              <div className="flex justify-between py-1 border-b border-indigo-500/30">
                <span className="text-muted-foreground font-semibold">Candidate Full Name:</span>
                <span className="font-bold text-foreground">{record.candidate_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-indigo-500/30">
                <span className="text-muted-foreground font-semibold">Designation:</span>
                <span className="font-medium text-foreground">{record.designation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-indigo-500/30">
                <span className="text-muted-foreground font-semibold">Department / Team:</span>
                <span className="font-medium text-foreground">{record.team_name || record.department || 'NavGurukul'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-indigo-500/30">
                <span className="text-muted-foreground font-semibold">Generated Official Email:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {record.candidate_name.toLowerCase().replace(/\s+/g, '.')}@navgurukul.org
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground font-semibold">Candidate Personal Email:</span>
                <span className="font-mono text-muted-foreground">{record.personal_email}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="font-bold text-foreground">Automatic Actions on Provisioning:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                <li>Create and activate official Google Workspace account.</li>
                <li>Assign permanent unique employee identifier (e.g. <code>NG-2026-XXXX</code>).</li>
                <li>Link candidate profile directly to the central <strong>Employee Directory</strong>.</li>
                <li>Dispatch welcome onboarding packet and credentials to candidate personal email.</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setProvisionDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleProvisionAccount}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
            >
              Confirm & Provision Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
