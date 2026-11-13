'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Laptop,
  Building,
  Mail,
  FileCheck2,
  FileText,
  Banknote,
  ShieldCheck,
  ShieldAlert,
  Send,
  Download,
  Printer,
  ChevronRight,
  MoreVertical,
  Check,
  X,
  Edit3,
  ExternalLink,
  Layers,
  History,
  Lock,
  UserMinus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FullOffboardingData,
  ChecklistItemStatus,
  AssetReturnStatus,
  AssetCondition,
  NDCStatus,
  FnFStatus,
  OffboardingChecklistItem,
  OffboardingAssetItem,
  OffboardingNDCDepartment,
} from '@/lib/offboarding/types';
import {
  updateChecklistItem,
  updateAssetClearance,
  updateNDCDepartment,
  updateFnFDetails,
  updateExitDates,
  closeOffboardingCase,
  generateExitDocument,
} from '@/lib/offboarding/service';
import { formatDate } from '@/lib/employees/tenure';
import { DocumentLetterhead } from '@/components/shared/document-letterhead';
import { toast } from 'sonner';

interface CaseDetailViewProps {
  data: FullOffboardingData;
}

export function CaseDetailView({ data: initialData }: CaseDetailViewProps) {
  const router = useRouter();
  const [data, setData] = useState<FullOffboardingData>(initialData);
  const [activeTab, setActiveTab] = useState('overview');
  const [isPending, startTransition] = useTransition();

  const caseRec = data.caseRecord;

  // Dialog States
  const [lwdModalOpen, setLwdModalOpen] = useState(false);
  const [lwdForm, setLwdForm] = useState({
    proposed_lwd: caseRec.proposed_lwd,
    actual_lwd: caseRec.actual_lwd || caseRec.proposed_lwd,
    reason: '',
  });

  const [closeExitModalOpen, setCloseExitModalOpen] = useState(false);
  const [docPreviewModalOpen, setDocPreviewModalOpen] = useState(false);
  const [previewDocType, setPreviewDocType] = useState<'ndc' | 'experience_letter'>('ndc');

  // Checklist Item Edit Dialog
  const [selectedChecklistItem, setSelectedChecklistItem] = useState<OffboardingChecklistItem | null>(null);
  const [chkNoteInput, setChkNoteInput] = useState('');

  // Asset Edit Dialog
  const [selectedAsset, setSelectedAsset] = useState<OffboardingAssetItem | null>(null);
  const [assetEditForm, setAssetEditForm] = useState<{
    return_status: AssetReturnStatus;
    condition: AssetCondition;
    recovery_amount: number;
    clearance_notes: string;
  }>({
    return_status: 'pending_return',
    condition: 'good',
    recovery_amount: 0,
    clearance_notes: '',
  });

  // NDC Edit Dialog
  const [selectedNdc, setSelectedNdc] = useState<OffboardingNDCDepartment | null>(null);
  const [ndcEditForm, setNdcEditForm] = useState<{
    status: NDCStatus;
    remarks: string;
    blocker_reason: string;
  }>({
    status: 'pending',
    remarks: '',
    blocker_reason: '',
  });

  // FnF Edit Dialog
  const [fnfModalOpen, setFnfModalOpen] = useState(false);
  const [fnfForm, setFnfForm] = useState({
    status: data.fnf.status,
    payable_days: data.fnf.payable_days,
    leave_encashment_days: data.fnf.leave_encashment_days,
    gratuity_eligible: data.fnf.gratuity_eligible,
    asset_recovery_amount: data.fnf.asset_recovery_amount,
    other_deductions: data.fnf.other_deductions,
    payment_reference: data.fnf.payment_reference || '',
    remarks: data.fnf.remarks || '',
  });

  // Progress metrics
  const checklistTotal = data.checklist.length;
  const checklistDone = data.checklist.filter(
    (c) => c.status === 'completed' || c.status === 'waived'
  ).length;
  const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 100;

  const ndcTotal = data.ndc.length;
  const ndcCleared = data.ndc.filter((n) => n.status === 'cleared').length;

  const assetsTotal = data.assets.length;
  const assetsCleared = data.assets.filter(
    (a) => a.return_status === 'cleared' || a.return_status === 'returned' || a.return_status === 'waived'
  ).length;

  // LWD Calculations
  const today = new Date();
  const proposedDate = new Date(caseRec.proposed_lwd);
  const daysDiff = Math.ceil((proposedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isLwdPassed = daysDiff < 0;

  // Handlers
  const handleToggleChecklist = (item: OffboardingChecklistItem) => {
    const nextStatus: ChecklistItemStatus = item.status === 'completed' ? 'pending' : 'completed';
    startTransition(async () => {
      const res = await updateChecklistItem(caseRec.id, item.id, {
        status: nextStatus,
        completed_by: 'P&C Operations',
      });
      if (res.success) {
        toast.success(`"${item.title}" updated`);
        setData((prev) => ({
          ...prev,
          checklist: prev.checklist.map((c) =>
            c.id === item.id ? { ...c, status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null } : c
          ),
        }));
      } else {
        toast.error(res.error || 'Failed to update item');
      }
    });
  };

  const handleSaveChecklistNotes = () => {
    if (!selectedChecklistItem) return;
    startTransition(async () => {
      const res = await updateChecklistItem(caseRec.id, selectedChecklistItem.id, {
        notes: chkNoteInput,
      });
      if (res.success) {
        toast.success('Notes saved');
        setData((prev) => ({
          ...prev,
          checklist: prev.checklist.map((c) =>
            c.id === selectedChecklistItem.id ? { ...c, notes: chkNoteInput } : c
          ),
        }));
        setSelectedChecklistItem(null);
      }
    });
  };

  const handleSaveAssetClearance = () => {
    if (!selectedAsset) return;
    startTransition(async () => {
      const res = await updateAssetClearance(caseRec.id, selectedAsset.id, {
        return_status: assetEditForm.return_status,
        condition: assetEditForm.condition,
        recovery_amount: assetEditForm.recovery_amount,
        clearance_notes: assetEditForm.clearance_notes,
        verified_by: 'IT Operations Desk',
      });
      if (res.success) {
        toast.success('Asset clearance updated');
        setData((prev) => ({
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === selectedAsset.id ? { ...a, ...assetEditForm } : a
          ),
        }));
        setSelectedAsset(null);
      } else {
        toast.error(res.error || 'Failed to update asset');
      }
    });
  };

  const handleSaveNdc = () => {
    if (!selectedNdc) return;
    startTransition(async () => {
      const res = await updateNDCDepartment(caseRec.id, selectedNdc.department, {
        status: ndcEditForm.status,
        remarks: ndcEditForm.remarks,
        blocker_reason: ndcEditForm.blocker_reason,
        cleared_by: ndcEditForm.status === 'cleared' ? 'Department Signatory' : null,
      });
      if (res.success) {
        toast.success(`${selectedNdc.department_label} status updated`);
        setData((prev) => ({
          ...prev,
          ndc: prev.ndc.map((n) =>
            n.department === selectedNdc.department
              ? { ...n, ...ndcEditForm, cleared_at: ndcEditForm.status === 'cleared' ? new Date().toISOString() : null }
              : n
          ),
        }));
        setSelectedNdc(null);
      } else {
        toast.error(res.error || 'Failed to update NDC');
      }
    });
  };

  const handleSaveFnF = () => {
    startTransition(async () => {
      const res = await updateFnFDetails(caseRec.id, {
        status: fnfForm.status,
        payable_days: fnfForm.payable_days,
        leave_encashment_days: fnfForm.leave_encashment_days,
        gratuity_eligible: fnfForm.gratuity_eligible,
        asset_recovery_amount: fnfForm.asset_recovery_amount,
        other_deductions: fnfForm.other_deductions,
        payment_reference: fnfForm.payment_reference,
        remarks: fnfForm.remarks,
      });
      if (res.success) {
        toast.success('F&F settlement details updated');
        setData((prev) => ({
          ...prev,
          fnf: { ...prev.fnf, ...fnfForm },
        }));
        setFnfModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to update F&F');
      }
    });
  };

  const handleSaveLwd = () => {
    startTransition(async () => {
      const res = await updateExitDates(
        caseRec.id,
        lwdForm.proposed_lwd,
        lwdForm.actual_lwd,
        lwdForm.reason
      );
      if (res.success) {
        toast.success('Exit dates updated');
        setData((prev) => ({
          ...prev,
          caseRecord: {
            ...prev.caseRecord,
            proposed_lwd: lwdForm.proposed_lwd,
            actual_lwd: lwdForm.actual_lwd,
          },
        }));
        setLwdModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to update dates');
      }
    });
  };

  const handleCloseExit = () => {
    startTransition(async () => {
      const res = await closeOffboardingCase(
        caseRec.id,
        'P&C Operations Lead',
        caseRec.actual_lwd || caseRec.proposed_lwd
      );
      if (res.success) {
        toast.success(`Exit successfully finalized! ${caseRec.employee_name} marked as Exited.`);
        setCloseExitModalOpen(false);
        setData((prev) => ({
          ...prev,
          caseRecord: {
            ...prev.caseRecord,
            status: 'completed',
            actual_lwd: prev.caseRecord.actual_lwd || prev.caseRecord.proposed_lwd,
            exit_closed_at: new Date().toISOString(),
            exit_closed_by: 'P&C Operations Lead',
          },
        }));
      } else {
        toast.error(res.error || 'Could not close exit case');
      }
    });
  };

  const handleGenerateDoc = (docType: 'ndc' | 'experience_letter') => {
    startTransition(async () => {
      toast.loading(`Generating ${docType === 'ndc' ? 'No Dues Certificate' : 'Relieving & Experience Letter'}...`, { id: 'doc-gen' });
      const res = await generateExitDocument(caseRec.id, docType);
      if (res.success && res.document) {
        toast.success('Document generated successfully!', { id: 'doc-gen' });
        setData((prev) => ({
          ...prev,
          documents: [res.document!, ...prev.documents.filter((d) => d.document_type !== docType)],
        }));
        setPreviewDocType(docType);
        setDocPreviewModalOpen(true);
      } else {
        toast.error('Failed to generate document', { id: 'doc-gen' });
      }
    });
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-700 text-white hover:bg-emerald-800">
            Officially Exited
          </Badge>
        );
      case 'settlement_pending':
        return (
          <Badge className="bg-purple-600 text-white hover:bg-purple-700">
            F&F Settlement
          </Badge>
        );
      case 'clearance_in_progress':
        return (
          <Badge className="bg-amber-700 text-white hover:bg-amber-800">
            Clearance In Progress
          </Badge>
        );
      case 'notice_period':
        return (
          <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">
            Serving Notice Period
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/offboarding"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to All Exit Cases</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLwdModalOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Calendar className="size-3.5" />
            <span>Adjust Last Working Day</span>
          </Button>

          {caseRec.status !== 'completed' && (
            <Button
              size="sm"
              onClick={() => setCloseExitModalOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              <ShieldCheck className="size-3.5" />
              <span>Complete Exit & Mark Exited</span>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Profile & Case Header */}
      <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-14 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 font-bold text-lg ring-2 ring-rose-500/20 shrink-0">
                <AvatarFallback className="rounded-xl">
                  {caseRec.employee_name.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground">
                    {caseRec.employee_name}
                  </h1>
                  {renderStatusBadge(caseRec.status)}
                  <Badge variant="outline" className="text-xs capitalize">
                    {caseRec.exit_type.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{caseRec.employee_designation}</span>
                  <span>•</span>
                  <span>{caseRec.employee_department}</span>
                  <span>•</span>
                  <span>{caseRec.employee_type}</span>
                  <span>•</span>
                  <span>Manager: {caseRec.manager_name || 'Reporting Manager'}</span>
                </div>
              </div>
            </div>

            {/* Countdown / LWD Card */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/80 border border-border shrink-0">
              <div className="size-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Clock className="size-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Last Working Day
                </span>
                <span className="text-sm font-bold text-foreground block">
                  {formatDate(caseRec.actual_lwd || caseRec.proposed_lwd)}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {caseRec.status === 'completed' ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Exit Formally Closed</span>
                  ) : isLwdPassed ? (
                    <span className="text-rose-700 dark:text-rose-300 font-semibold">{Math.abs(daysDiff)} days elapsed since LWD</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300 font-medium">{daysDiff} days remaining</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="p-4 bg-muted/20 border-b border-border/60">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground">Offboarding Lifecycle Progress</span>
              <span className="text-foreground font-semibold">
                {checklistPct}% Checklist • {ndcCleared}/{ndcTotal} NDC Sign-offs
              </span>
            </div>
            <Progress value={checklistPct} className="h-2 rounded-full" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="size-3.5" /> 1. Initiated
            </div>
            <div className={`flex items-center gap-1.5 ${caseRec.status !== 'initiated' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>
              <CheckCircle2 className="size-3.5" /> 2. Notice Period
            </div>
            <div className={`flex items-center gap-1.5 ${checklistPct >= 80 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-foreground font-medium'}`}>
              <CheckCircle2 className="size-3.5" /> 3. Clearances
            </div>
            <div className={`flex items-center gap-1.5 ${ndcCleared === ndcTotal ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-foreground font-medium'}`}>
              <CheckCircle2 className="size-3.5" /> 4. NDC Sign-Off
            </div>
            <div className={`flex items-center gap-1.5 ${data.fnf.status === 'processed' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-foreground font-medium'}`}>
              <CheckCircle2 className="size-3.5" /> 5. F&F Settlement
            </div>
            <div className={`flex items-center gap-1.5 ${caseRec.status === 'completed' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>
              <CheckCircle2 className="size-3.5" /> 6. Exit Closed
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/60 p-1 rounded-xl w-full justify-start overflow-x-auto flex-nowrap border border-border">
          <TabsTrigger value="overview" className="text-xs rounded-lg py-1.5 px-3">
            Overview & Timeline
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs rounded-lg py-1.5 px-3">
            Exit Checklist ({checklistDone}/{checklistTotal})
          </TabsTrigger>
          <TabsTrigger value="assets" className="text-xs rounded-lg py-1.5 px-3">
            Asset Clearances ({assetsCleared}/{assetsTotal})
          </TabsTrigger>
          <TabsTrigger value="ndc" className="text-xs rounded-lg py-1.5 px-3">
            Departmental NDC ({ndcCleared}/{ndcTotal})
          </TabsTrigger>
          <TabsTrigger value="fnf" className="text-xs rounded-lg py-1.5 px-3">
            F&F Settlement
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs rounded-lg py-1.5 px-3">
            Documents & Closure
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW & TIMELINE */}
        {/* ================================================================= */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Case Details Card */}
            <Card className="rounded-xl border border-border bg-card shadow-xs md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Separation Context & Terms</CardTitle>
                <CardDescription className="text-xs">
                  Recorded terms established at the initiation of separation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">Primary Reason:</span>
                  <span className="font-semibold text-foreground">{caseRec.reason}</span>
                </div>
                {caseRec.reason_details && (
                  <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                    <span className="text-muted-foreground">Handover Notes:</span>
                    <span className="text-foreground leading-relaxed">{caseRec.reason_details}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">Initiated Date:</span>
                  <span className="font-medium text-foreground">{formatDate(caseRec.initiated_date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">Initiated By:</span>
                  <span className="font-medium text-foreground">{caseRec.initiated_by}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">Contractual Notice:</span>
                  <span className="font-medium text-foreground">
                    {caseRec.notice_period_waived ? 'Waived (0 Days)' : `${caseRec.notice_period_days} Days`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">Proposed Last Working Day:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{formatDate(caseRec.proposed_lwd)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">Official Confirmed LWD:</span>
                  <span className="font-semibold text-foreground">
                    {caseRec.actual_lwd ? formatDate(caseRec.actual_lwd) : 'Pending Final Closure'}
                  </span>
                </div>
                {caseRec.exception_notes && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                    <span className="font-bold block text-xs">Policy Exception Note:</span>
                    <p className="mt-0.5 text-xs">{caseRec.exception_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Status Summary Column */}
            <div className="space-y-4">
              <Card className="rounded-xl border border-border bg-card shadow-xs p-4 space-y-3">
                <span className="text-xs font-semibold text-foreground block">Clearance Health Check</span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Checklist Items:</span>
                    <span className="font-bold">{checklistDone} / {checklistTotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Hardware Return:</span>
                    <span className="font-bold">{assetsCleared} / {assetsTotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Department NDC:</span>
                    <span className="font-bold">{ndcCleared} / {ndcTotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">F&F State:</span>
                    <span className="font-bold uppercase text-[10px]">{data.fnf.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </Card>

              {data.fnf.blocked_reasons && data.fnf.blocked_reasons.length > 0 && (
                <Card className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" /> Pending Settlement Blockers
                  </span>
                  <ul className="text-xs text-rose-950 dark:text-rose-200 space-y-1 list-disc pl-4">
                    {data.fnf.blocked_reasons.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>

          {/* Activity Log / Audit Trail */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="size-4 text-indigo-600 dark:text-indigo-400" />
                    Case Activity Log & Audit Trail
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Complete chronological history of state transitions, reminders, and verification sign-offs.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {data.activityLogs.length} Events
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.activityLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity events recorded yet.</p>
                ) : (
                  data.activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                      <div className="size-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground mt-0.5 shrink-0">
                        <Clock className="size-3" />
                      </div>
                      <div className="flex-1 space-y-0.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{log.action}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{log.description}</p>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          By {log.actor_name} ({log.actor_role})
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: EXIT CHECKLIST */}
        {/* ================================================================= */}
        <TabsContent value="checklist" className="space-y-4 mt-4">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Mandatory Exit Checkpoints</CardTitle>
                  <CardDescription className="text-xs">
                    Checklist items owned across Employee, Manager, IT Admin, Finance, and P&C teams.
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-foreground">
                  {checklistDone} of {checklistTotal} items completed ({checklistPct}%)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-xs font-semibold">Checkpoint Item</TableHead>
                      <TableHead className="text-xs font-semibold">Owner Role</TableHead>
                      <TableHead className="text-xs font-semibold">Assignee</TableHead>
                      <TableHead className="text-xs font-semibold">Due Date</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Notes & Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {data.checklist.map((item) => {
                      const isComplete = item.status === 'completed';
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell className="py-3">
                            <input
                              type="checkbox"
                              checked={isComplete}
                              onChange={() => handleToggleChecklist(item)}
                              disabled={isPending}
                              className="size-4 rounded text-rose-700 dark:text-rose-300 focus:ring-rose-500 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="space-y-0.5 max-w-sm">
                              <span className={`text-xs font-semibold block ${isComplete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.title}
                              </span>
                              {item.description && (
                                <span className="text-[11px] text-muted-foreground block line-clamp-2">
                                  {item.description}
                                </span>
                              )}
                              {item.notes && (
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">
                                  Note: {item.notes}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {item.owner_role.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground">
                            {item.assigned_to_name || '—'}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground">
                            {item.due_date ? formatDate(item.due_date) : '—'}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                item.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : item.status === 'blocked'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                  : item.status === 'in_progress'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {item.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedChecklistItem(item);
                                setChkNoteInput(item.notes || '');
                              }}
                              className="h-7 text-xs px-2"
                            >
                              <Edit3 className="size-3 mr-1" /> Add Note
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: ASSET CLEARANCES */}
        {/* ================================================================= */}
        <TabsContent value="assets" className="space-y-4 mt-4">
          {/* External Asset System Integration Boundary Banner */}
          <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Laptop className="size-4" />
              </div>
              <div>
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <span>External Asset Management API</span>
                  <Badge variant="outline" className="text-[10px] border-indigo-500 text-indigo-700 dark:text-indigo-300">
                    Source of Truth
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ELC consumes asset assignments and recovery rules live. Local clearances act as workflow verification.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block">Assigned Count</span>
                <span className="font-bold text-foreground">
                  {data.externalAssetsSummary?.total_assigned_count || data.assets.length} Assets
                </span>
              </div>
              <div className="text-right border-l border-border/80 pl-3">
                <span className="text-[10px] text-muted-foreground block">External Recovery Flag</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  ₹{(data.externalAssetsSummary?.total_recovery_required ?? data.fnf.asset_recovery_amount ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Laptop className="size-4 text-indigo-700 dark:text-indigo-300" />
                    Hardware & Company Asset Clearances
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect physical return status, assess damage conditions, and log recovery / waiver decisions.
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-foreground">
                  {assetsCleared} of {assetsTotal} assets cleared
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Asset Name & Tag</TableHead>
                      <TableHead className="text-xs font-semibold">Type</TableHead>
                      <TableHead className="text-xs font-semibold">Condition</TableHead>
                      <TableHead className="text-xs font-semibold">Return Status</TableHead>
                      <TableHead className="text-xs font-semibold">Recovery / Dues</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {data.assets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                          No company hardware assigned to this team member.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.assets.map((asset) => (
                        <TableRow key={asset.id} className="hover:bg-muted/30">
                          <TableCell className="py-3">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-xs text-foreground block">
                                {asset.asset_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                Tag: {asset.asset_tag || 'No Tag Recorded'}
                              </span>
                              {asset.clearance_notes && (
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block">
                                  {asset.clearance_notes}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {asset.asset_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs capitalize font-medium text-foreground">
                              {asset.condition || 'Good'}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold capitalize ${
                                asset.return_status === 'cleared' || asset.return_status === 'returned'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : asset.return_status === 'under_recovery' || asset.return_status === 'damaged'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {asset.return_status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            {asset.recovery_amount && asset.recovery_amount > 0 ? (
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                ₹{asset.recovery_amount.toLocaleString()} (Recovery)
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">₹0</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setAssetEditForm({
                                  return_status: asset.return_status,
                                  condition: asset.condition || 'good',
                                  recovery_amount: asset.recovery_amount || 0,
                                  clearance_notes: asset.clearance_notes || '',
                                });
                              }}
                              className="h-7 text-xs"
                            >
                              Update Status
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 4: DEPARTMENTAL NDC (NO DUES CERTIFICATE) */}
        {/* ================================================================= */}
        <TabsContent value="ndc" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.ndc.map((dept) => {
              const isCleared = dept.status === 'cleared';
              const isBlocked = dept.status === 'blocked';

              return (
                <Card
                  key={dept.department}
                  className={`rounded-xl border shadow-xs transition-all ${
                    isCleared
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : isBlocked
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{dept.department_label}</CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize font-semibold ${
                          isCleared
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : isBlocked
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {dept.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <p className="text-muted-foreground leading-relaxed">
                      {dept.remarks || 'No remarks logged.'}
                    </p>
                    {dept.blocker_reason && (
                      <div className="p-2 rounded bg-rose-500/10 text-rose-900 dark:text-rose-200 font-medium">
                        Blocker: {dept.blocker_reason}
                      </div>
                    )}
                    {dept.cleared_at && (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block">
                        Cleared by {dept.cleared_by || 'Department'} on {formatDate(dept.cleared_at)}
                      </span>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedNdc(dept);
                        setNdcEditForm({
                          status: dept.status,
                          remarks: dept.remarks || '',
                          blocker_reason: dept.blocker_reason || '',
                        });
                      }}
                      className="h-7 text-xs"
                    >
                      Update Clearance
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <Card className="rounded-xl border border-border bg-card shadow-xs p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground">No Dues Certificate (NDC Document)</span>
              <p className="text-[11px] text-muted-foreground">
                Generate formal consolidated clearance certificate once all departmental checkpoints are satisfied.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleGenerateDoc('ndc')}
              className="h-8 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <FileCheck2 className="size-3.5" />
              <span>Generate NDC Certificate</span>
            </Button>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 5: F&F SETTLEMENT */}
        {/* ================================================================= */}
        <TabsContent value="fnf" className="space-y-4 mt-4">
          {/* External Integrations Boundary for F&F: Attendance & Leave APIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attendance API Source */}
            <Card className="rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                  <Clock className="size-3.5" />
                  <span>External Attendance Cloud API</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-700 dark:text-blue-300 bg-background">
                  Source of Truth
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Consumes verified biometric swipe logs to determine actual payable days for final settlement.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-500/20 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Last Recorded Swipe:</span>
                  <span className="font-semibold text-foreground">
                    {data.externalAttendanceSummary?.last_recorded_swipe_date || caseRec.actual_lwd || caseRec.proposed_lwd}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Calculated Payable Days:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {data.externalAttendanceSummary?.calculated_payable_days ?? data.fnf.payable_days} Days
                  </span>
                </div>
              </div>
            </Card>

            {/* Leave API Source */}
            <Card className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                  <Calendar className="size-3.5" />
                  <span>External Enterprise HRMS Leave API</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-background">
                  Source of Truth
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Consumes earned privilege leave balances to compute statutory encashment credit.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Encashable Days:</span>
                  <span className="font-semibold text-foreground">
                    {data.externalLeaveSummary?.total_encashable_days ?? data.fnf.leave_encashment_days} Days
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Per-Day Encashment Rate:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    ₹{(data.externalLeaveSummary?.per_day_encashment_rate_inr ?? 2500).toLocaleString()} / day
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader>

              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Banknote className="size-4 text-purple-700 dark:text-purple-300" />
                    Full & Final Settlement (F&F) Computation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Reconciliation of payable working days, leave encashment, asset recoveries, and payment disbursement.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setFnfModalOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Edit3 className="size-3.5" /> Update Settlement
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border/80">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Payable Days:</span>
                  <span className="text-base font-bold text-foreground">{data.fnf.payable_days} Days</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Leave Encashment:</span>
                  <span className="text-base font-bold text-foreground">{data.fnf.leave_encashment_days} Days</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Asset Deductions:</span>
                  <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                    ₹{data.fnf.asset_recovery_amount?.toLocaleString() || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Settlement Status:</span>
                  <Badge variant="outline" className="mt-0.5 text-xs font-semibold capitalize">
                    {data.fnf.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>

              {data.fnf.payment_reference && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Payment Disbursed & Verified
                  </span>
                  <p className="text-muted-foreground font-mono">
                    Bank Reference / UTR: {data.fnf.payment_reference}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 6: DOCUMENTS & OFFICIAL CLOSURE */}
        {/* ================================================================= */}
        <TabsContent value="documents" className="space-y-6 mt-4">
          {/* Document Generation Library */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Exit Document Repository</CardTitle>
              <CardDescription className="text-xs">
                Official certificates and letters issued to departing team member upon separation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                    <FileCheck2 className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      No Dues Certificate (NDC)
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Clearance certification signed by Department Heads
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateDoc('ndc')}
                    className="h-8 text-xs gap-1.5"
                  >
                    Generate / Preview
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Relieving & Experience Certificate
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Formal letter confirming tenure, role, and official relief date
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateDoc('experience_letter')}
                    className="h-8 text-xs gap-1.5"
                  >
                    Generate / Preview
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Official Final Exit Closure Card */}
          <Card className="rounded-xl border border-rose-500/30 bg-rose-500/5 shadow-xs">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-rose-700 dark:text-rose-300" />
                <CardTitle className="text-base font-semibold text-rose-950 dark:text-rose-100">
                  Official Exit Confirmation & Case Closure
                </CardTitle>
              </div>
              <CardDescription className="text-xs leading-relaxed">
                <strong>Important Distinction:</strong> An employee reaching their &ldquo;Last Working Day&rdquo; does not
                automatically mean their exit is closed. Final closure confirms all checklists, assets, NDC, and
                settlement dues are resolved. Closing the case officially transitions the employee status in the
                primary Directory to <strong>Exited</strong> and establishes their permanent exit record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {caseRec.status === 'completed' ? (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    Exit Case Officially Closed
                  </span>
                  <p className="text-muted-foreground">
                    Closed by {caseRec.exit_closed_by || 'P&C Operations'} on{' '}
                    {formatDate(caseRec.exit_closed_at || caseRec.updated_at)}.
                    Employee is registered as Exited in the active roster.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-background border border-border text-xs space-y-1">
                    <span className="font-semibold text-foreground">Closure Verification Gates:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground text-[11px]">
                      <li>Checklist Completed: {checklistPct}%</li>
                      <li>Department NDC Cleared: {ndcCleared} of {ndcTotal} departments</li>
                      <li>Hardware Assets Returned: {assetsCleared} of {assetsTotal} items</li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => setCloseExitModalOpen(true)}
                    className="w-full h-9 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                  >
                    Confirm & Execute Final Exit Closure
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust LWD Dialog */}
      <Dialog open={lwdModalOpen} onOpenChange={setLwdModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Adjust Last Working Day</DialogTitle>
            <DialogDescription className="text-xs">
              Update expected or confirmed last working day. This change will be logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Proposed Last Working Day</Label>
              <Input
                type="date"
                value={lwdForm.proposed_lwd}
                onChange={(e) => setLwdForm({ ...lwdForm, proposed_lwd: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Actual Confirmed Last Working Day</Label>
              <Input
                type="date"
                value={lwdForm.actual_lwd}
                onChange={(e) => setLwdForm({ ...lwdForm, actual_lwd: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reason for Adjustment</Label>
              <Input
                placeholder="e.g. Mutual notice buyout, earlier project release, extension..."
                value={lwdForm.reason}
                onChange={(e) => setLwdForm({ ...lwdForm, reason: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLwdModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveLwd} disabled={isPending} className="text-xs">
              Save Timeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Notes Dialog */}
      <Dialog open={Boolean(selectedChecklistItem)} onOpenChange={() => setSelectedChecklistItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Checklist Item Notes</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedChecklistItem?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              rows={4}
              placeholder="Add handover progress, file links, or notes..."
              value={chkNoteInput}
              onChange={(e) => setChkNoteInput(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedChecklistItem(null)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveChecklistNotes} disabled={isPending} className="text-xs">
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Status Edit Dialog */}
      <Dialog open={Boolean(selectedAsset)} onOpenChange={() => setSelectedAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Update Asset Clearance</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedAsset?.asset_name} ({selectedAsset?.asset_tag || 'No Tag'})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Return Status</Label>
              <Select
                value={assetEditForm.return_status}
                onValueChange={(val: AssetReturnStatus) =>
                  setAssetEditForm({ ...assetEditForm, return_status: val })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_return">Pending Return</SelectItem>
                  <SelectItem value="returned">Returned & Inspected</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="damaged">Damaged (Assessment Required)</SelectItem>
                  <SelectItem value="under_recovery">Under Recovery (Cost Deduction)</SelectItem>
                  <SelectItem value="waived">Waived / Gifted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Physical Condition</Label>
              <Select
                value={assetEditForm.condition}
                onValueChange={(val: AssetCondition) =>
                  setAssetEditForm({ ...assetEditForm, condition: val })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good / Normal Wear</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="missing">Missing / Not Recoverable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Recovery Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={assetEditForm.recovery_amount}
                onChange={(e) =>
                  setAssetEditForm({ ...assetEditForm, recovery_amount: parseFloat(e.target.value) || 0 })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Clearance Notes</Label>
              <Input
                placeholder="Inspection notes or damage quote..."
                value={assetEditForm.clearance_notes}
                onChange={(e) =>
                  setAssetEditForm({ ...assetEditForm, clearance_notes: e.target.value })
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedAsset(null)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAssetClearance} disabled={isPending} className="text-xs">
              Save Asset Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NDC Edit Dialog */}
      <Dialog open={Boolean(selectedNdc)} onOpenChange={() => setSelectedNdc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {selectedNdc?.department_label} Clearance
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage sign-off or document pending blockers for this department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Clearance Status</Label>
              <Select
                value={ndcEditForm.status}
                onValueChange={(val: NDCStatus) =>
                  setNdcEditForm({ ...ndcEditForm, status: val })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="cleared">Cleared (Approved)</SelectItem>
                  <SelectItem value="blocked">Blocked / Exception</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Remarks</Label>
              <Input
                placeholder="Handover validated, accounts checked..."
                value={ndcEditForm.remarks}
                onChange={(e) => setNdcEditForm({ ...ndcEditForm, remarks: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            {ndcEditForm.status === 'blocked' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-rose-700 dark:text-rose-300">Blocker Reason *</Label>
                <Input
                  placeholder="Specify why clearance cannot be granted..."
                  value={ndcEditForm.blocker_reason}
                  onChange={(e) =>
                    setNdcEditForm({ ...ndcEditForm, blocker_reason: e.target.value })
                  }
                  className="h-8 text-xs border-rose-500/40"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedNdc(null)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveNdc} disabled={isPending} className="text-xs">
              Save Sign-Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F&F Settlement Dialog */}
      <Dialog open={fnfModalOpen} onOpenChange={setFnfModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Update F&F Settlement</DialogTitle>
            <DialogDescription className="text-xs">
              Record final settlement computation details and payment release reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">F&F Status</Label>
              <Select
                value={fnfForm.status}
                onValueChange={(val: FnFStatus) => setFnfForm({ ...fnfForm, status: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awaiting_clearance">Awaiting Clearance</SelectItem>
                  <SelectItem value="computation_pending">Computation Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="processing">Processing Disbursement</SelectItem>
                  <SelectItem value="processed">Processed & Paid</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payable Working Days</Label>
                <Input
                  type="number"
                  min={0}
                  value={fnfForm.payable_days}
                  onChange={(e) => setFnfForm({ ...fnfForm, payable_days: parseInt(e.target.value) || 0 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Leave Encashment Days</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={fnfForm.leave_encashment_days}
                  onChange={(e) =>
                    setFnfForm({ ...fnfForm, leave_encashment_days: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Asset Deductions (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={fnfForm.asset_recovery_amount}
                  onChange={(e) =>
                    setFnfForm({ ...fnfForm, asset_recovery_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Other Deductions (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={fnfForm.other_deductions}
                  onChange={(e) =>
                    setFnfForm({ ...fnfForm, other_deductions: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Bank Reference / UTR</Label>
              <Input
                placeholder="e.g. HDFC-NEFT-2026-90412"
                value={fnfForm.payment_reference}
                onChange={(e) => setFnfForm({ ...fnfForm, payment_reference: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Remarks</Label>
              <Input
                placeholder="Disbursement remarks..."
                value={fnfForm.remarks}
                onChange={(e) => setFnfForm({ ...fnfForm, remarks: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFnfModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveFnF} disabled={isPending} className="text-xs">
              Save Settlement Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Exit Closure Modal */}
      <Dialog open={closeExitModalOpen} onOpenChange={setCloseExitModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="size-4" /> Confirm Official Exit Closure
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to finalize separation for <strong>{caseRec.employee_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Executing this action will:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>Formally close the exit lifecycle case</li>
              <li>
                Update the employee’s status in the primary Employee Directory from <strong>Active</strong> to{' '}
                <strong>Exited</strong>
              </li>
              <li>Set their permanent official exit date to <strong>{formatDate(caseRec.actual_lwd || caseRec.proposed_lwd)}</strong></li>
              <li>Generate the Relieving & Experience Letter and send dispatch confirmation to the employee</li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCloseExitModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCloseExit}
              disabled={isPending}
              className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isPending ? 'Finalizing...' : 'Confirm & Execute Closure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={docPreviewModalOpen} onOpenChange={setDocPreviewModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck2 className="size-4 text-indigo-700 dark:text-indigo-300" />
              {previewDocType === 'ndc' ? 'No Dues Certificate (NDC)' : 'Relieving & Experience Certificate'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generated official document preview for {caseRec.employee_name}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 bg-white dark:bg-zinc-950 rounded-xl border border-border shadow-xs text-foreground text-xs space-y-6">
            <DocumentLetterhead />

            <div className="text-center space-y-1 border-b border-border/60 pb-4">
              <h2 className="text-base font-bold uppercase tracking-wide">
                {previewDocType === 'ndc' ? 'NO DUES CLEARANCE CERTIFICATE' : 'RELIEVING & SERVICE CERTIFICATE'}
              </h2>
              <span className="text-muted-foreground text-[11px]">
                Reference: NG-ELC/{previewDocType.toUpperCase()}/{caseRec.id.slice(-6).toUpperCase()}
              </span>
            </div>

            {previewDocType === 'ndc' ? (
              <div className="space-y-4 leading-relaxed">
                <p>
                  This is to certify that <strong>{caseRec.employee_name}</strong>, who was employed as{' '}
                  <strong>{caseRec.employee_designation}</strong> in the <strong>{caseRec.employee_department}</strong> department,
                  has formally completed all exit formalities and clearance checkpoints.
                </p>

                <div className="border border-border rounded-lg overflow-hidden my-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Department</th>
                        <th className="py-2 px-3 font-semibold">Sign-off Status</th>
                        <th className="py-2 px-3 font-semibold">Authorized Authority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data.ndc.map((n) => (
                        <tr key={n.department}>
                          <td className="py-2 px-3 font-medium">{n.department_label}</td>
                          <td className="py-2 px-3">
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold capitalize">
                              {n.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{n.cleared_by || 'Signed on File'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p>
                  There are no pending dues, hardware assets, or documentation obligations outstanding from this team member.
                </p>
              </div>
            ) : (
              <div className="space-y-4 leading-relaxed">
                <p><strong>TO WHOMSOEVER IT MAY CONCERN</strong></p>

                <p>
                  This is to certify that <strong>{caseRec.employee_name}</strong> was associated with{' '}
                  <strong>NavGurukul Foundation for Social Welfare</strong> from{' '}
                  <strong>01 Jun 2024</strong> to{' '}
                  <strong>{formatDate(caseRec.actual_lwd || caseRec.proposed_lwd)}</strong>.
                </p>

                <p>
                  At the time of relief from duties, they were holding the position of{' '}
                  <strong>{caseRec.employee_designation}</strong> in the{' '}
                  <strong>{caseRec.employee_department}</strong> division.
                </p>

                <p>
                  During their tenure with us, we found them to be sincere, dedicated, and professional in carrying out their assigned responsibilities.
                  All organizational handovers, property, and obligations have been settled.
                </p>

                <p>
                  We thank them for their contributions to our mission and wish them every success in all future professional and personal endeavors.
                </p>
              </div>
            )}

            <div className="pt-8 flex items-end justify-between border-t border-border/60">
              <div>
                <span className="font-bold text-xs block">Authorized Signatory</span>
                <span className="text-muted-foreground text-[11px] block">People & Culture Operations</span>
                <span className="text-muted-foreground text-[11px] block">NavGurukul Foundation for Social Welfare</span>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <span>Date of Issue: {formatDate(new Date().toISOString())}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs gap-1.5">
              <Printer className="size-3.5" /> Print / Save as PDF
            </Button>
            <Button size="sm" onClick={() => setDocPreviewModalOpen(false)} className="text-xs">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
