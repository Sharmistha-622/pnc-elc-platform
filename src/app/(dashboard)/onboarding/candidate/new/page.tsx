'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus,
  ArrowLeft,
  Building,
  User,
  Calendar,
  Briefcase,
  IndianRupee,
  Clock,
  Sparkles,
  CheckCircle2,
  Send,
  FileText,
  MapPin,
  FileCheck2,
  Eye,
  Edit,
  Code,
  Check,
  Download,
} from 'lucide-react';
import { PageBanner } from '@/components/shared/page-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DocumentLetterhead } from '@/components/shared/document-letterhead';
import { downloadDocumentAsPdf } from '@/lib/letter-templates/download';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { LetterTemplate, STANDARD_PLACEHOLDERS } from '@/lib/letter-templates/types';
import { populateTemplatePlaceholders } from '@/lib/letter-templates/utils';
import {
  CTC_FREQUENCY_LABELS,
  annualisedCtc,
  compensationLabel,
  formatCompensation,
  formatIndianNumber,
  type CtcFrequency,
} from '@/lib/onboarding/compensation';
import { TONES } from '@/lib/ui/tone';

export default function CreateCandidateOnboardingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Dynamic Master Data
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<{ id: string; name: string; code: string }[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    candidate_name: '',
    personal_email: '',
    phone: '',
    designation: '',
    department: 'Tech & Product',
    team_name: 'Tech & Product',
    manager_name: '',
    buddy_name: '',
    location: 'Bangalore',
    employee_type_name: 'Consultant',
    joining_date: new Date().toISOString().split('T')[0],
    probation_period: '3 Months',
    notice_period: '1 Month',
    ctc_amount: 60000,
    ctc_frequency: 'monthly' as CtcFrequency,
    is_alumni: false,
    role_responsibilities:
      'Lead key engineering deliverables, mentor student cohorts, collaborate with cross-functional campus teams, and actively support student technical learning.',
    send_invite_immediately: true,
  });

  // Rendered compensation string, derived so the figure and its period can
  // never drift apart.
  const compensationDisplay = formatCompensation(formData.ctc_amount, formData.ctc_frequency);
  const annualised = annualisedCtc(formData.ctc_amount, formData.ctc_frequency);

  // Letter Customization State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isLetterCustomized, setIsLetterCustomized] = useState(false);
  const [customizedLetterContent, setCustomizedLetterContent] = useState<string>('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  useEffect(() => {
    // Fetch active departments
    fetch('/api/departments?includeArchived=false')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) setDepartments(json.data);
      })
      .catch(() => {});

    // Fetch active campuses
    fetch('/api/campuses?includeClosed=false')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) setCampuses(json.data);
      })
      .catch(() => {});

    // Fetch active employment types
    fetch('/api/employment-types?includeArchived=false')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) setEmploymentTypes(json.data);
      })
      .catch(() => {});

    // Fetch active letter templates
    fetch('/api/letter-templates?status=active')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setTemplates(json.data);
          // Set initial template if available
          const first = json.data.find((t: LetterTemplate) => t.employee_type_name === 'Consultant') || json.data[0];
          if (first) {
            setSelectedTemplateId(first.id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // If employee type changes, auto select best matching template
      if (field === 'employee_type_name') {
        const isFte = value.toLowerCase().includes('fte') || value.toLowerCase().includes('full-time employee');
        const isCons = value.toLowerCase().includes('consultant');
        const match = templates.find((t) => {
          if (isCons) return t.employee_type_name === 'Consultant';
          if (isFte) return t.employee_type_name === 'FTE';
          return true;
        });
        if (match) {
          setSelectedTemplateId(match.id);
        }
      }
      return updated;
    });
  };

  // Filter templates matching current employee type
  const matchingTemplates = useMemo(() => {
    const etName = formData.employee_type_name.toLowerCase();
    return templates.filter((t) => {
      const tName = t.employee_type_name.toLowerCase();
      if (etName.includes('consultant') && tName === 'consultant') return true;
      if ((etName.includes('fte') || etName.includes('full-time employee')) && tName === 'fte') return true;
      if (etName.includes('intern') && tName.includes('intern')) return true;
      return tName === etName;
    });
  }, [templates, formData.employee_type_name]);

  // Load template and map placeholders
  const handleUseTemplate = () => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) {
      toast.error('Please select a letter template first');
      return;
    }

    const populated = populateTemplatePlaceholders(template.content, {
      candidate_name: formData.candidate_name || '{{Full Name}}',
      designation: formData.designation || '{{Designation}}',
      department: formData.department || formData.team_name || '{{Department}}',
      manager_name: formData.manager_name || 'Reporting Manager',
      joining_date: formData.joining_date,
      location: formData.location,
      ctc: compensationDisplay,
      probation_period: formData.probation_period,
      notice_period: formData.notice_period,
      role_responsibilities: formData.role_responsibilities,
      personal_email: formData.personal_email,
    });

    setCustomizedLetterContent(populated);
    setIsLetterCustomized(true);
    toast.success(`Loaded "${template.name}" with candidate details mapped`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.candidate_name.trim()) {
      toast.error('Candidate full name is required');
      return;
    }
    if (!formData.personal_email.trim()) {
      toast.error('Personal email is required');
      return;
    }
    if (!formData.designation.trim()) {
      toast.error('Designation / Role title is required');
      return;
    }

    try {
      setSubmitting(true);
      // 1. Create Onboarding Record
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `ctc` stays on the payload as the rendered string letters read from;
        // the amount and period travel alongside it as the source of truth.
        body: JSON.stringify({ ...formData, ctc: compensationDisplay }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to create onboarding record');
      }

      const createdId = json.data.id;

      // 2. Save Customized Candidate Letter if generated
      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
      if (isLetterCustomized && customizedLetterContent && selectedTemplate) {
        try {
          await fetch('/api/candidate-letters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidate_id: createdId,
              candidate_name: formData.candidate_name,
              candidate_email: formData.personal_email,
              template_id: selectedTemplate.id,
              template_name: selectedTemplate.name,
              letter_type: selectedTemplate.letter_type,
              addendum_type: selectedTemplate.addendum_type,
              employee_type_name: formData.employee_type_name,
              content: customizedLetterContent,
            }),
          });
        } catch (e) {
          console.error('Failed to save candidate letter', e);
        }
      }

      // 3. Send Invitation if toggled
      if (formData.send_invite_immediately) {
        try {
          const sendRes = await fetch(`/api/onboarding/${createdId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_invitation' }),
          });
          const sendJson = await sendRes.json();
          if (sendJson.success) {
            toast.success(`Candidate created and invitation sent to ${formData.personal_email}`);
          }
        } catch (e) {
          toast.warning('Candidate record created, but invitation email could not be dispatched.');
        }
      } else {
        toast.success('Candidate onboarding draft created successfully');
      }

      router.push('/onboarding/candidate');
    } catch (err: any) {
      toast.error(err.message || 'Error creating candidate onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Return Breadcrumb */}
      <div>
        <Link
          href="/onboarding/candidate"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Candidate Pipeline</span>
        </Link>
      </div>

      {/* Banner */}
      <PageBanner
        title="Create Candidate Onboarding"
        description="Initiate onboarding for a new hire. Configure role, compensation, and select an official Letter Template to customize for this candidate."
        icon={<UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Candidate Core Details */}
        <Card className="rounded-xl border border-border/80 shadow-xs">
          <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-blue-700 dark:text-blue-300" />
              <span>1. Candidate Profile & Contact</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Primary identification details for sending invitation and portal token.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">Candidate Full Name *</Label>
              <Input
                placeholder="e.g., Kavita Rao"
                value={formData.candidate_name}
                onChange={(e) => handleChange('candidate_name', e.target.value)}
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Personal Email (Invitation Destination) *</Label>
              <Input
                type="email"
                placeholder="e.g., kavita.rao@example.com"
                value={formData.personal_email}
                onChange={(e) => handleChange('personal_email', e.target.value)}
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone Number</Label>
              <Input
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">NavGurukul Alumni</Label>
                <p className="text-[11px] text-muted-foreground">
                  Is this candidate a graduate/alumni of a NavGurukul residential school program?
                </p>
              </div>
              <Switch
                checked={formData.is_alumni}
                onCheckedChange={(checked) => handleChange('is_alumni', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Employment & Role Details */}
        <Card className="rounded-xl border border-border/80 shadow-xs">
          <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-700 dark:text-blue-300" />
              <span>2. Role, Department & Team Assignment</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Organizational hierarchy and employment classification.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Designation / Role Title *</Label>
              <Input
                placeholder="e.g., Software Engineer, Program Associate"
                value={formData.designation}
                onChange={(e) => handleChange('designation', e.target.value)}
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Department / Team</Label>
              <Select
                value={formData.department}
                onValueChange={(val) => {
                  handleChange('department', val);
                  handleChange('team_name', val);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.length > 0 ? (
                    departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Tech & Product">Tech & Product</SelectItem>
                      <SelectItem value="PnC">People & Culture (PnC)</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Academia">Academia & Curriculum</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Employee Type *
              </Label>
              <Select
                value={formData.employee_type_name}
                onValueChange={(val) => handleChange('employee_type_name', val)}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consultant">Consultant</SelectItem>
                  <SelectItem value="Full-Time Employee (FTE)">Full-Time Employee (FTE)</SelectItem>
                  <SelectItem value="Full-Time Consultant">Full-Time Consultant</SelectItem>
                  <SelectItem value="Intern">Intern</SelectItem>
                  <SelectItem value="Apprentice">Apprentice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Campus / Work Location</Label>
              <Select
                value={formData.location}
                onValueChange={(val) => handleChange('location', val)}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {campuses.length > 0 ? (
                    campuses.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Bangalore">Bangalore Campus / Hybrid</SelectItem>
                      <SelectItem value="Pune">Pune Campus</SelectItem>
                      <SelectItem value="Dharamshala">Dharamshala Campus</SelectItem>
                      <SelectItem value="Delhi / Remote">Delhi / Remote</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reporting Manager Name</Label>
              <Input
                placeholder="e.g., Nitin Sudarshan"
                value={formData.manager_name}
                onChange={(e) => handleChange('manager_name', e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Onboarding Buddy Name</Label>
              <Input
                placeholder="e.g., Rohit Verma"
                value={formData.buddy_name}
                onChange={(e) => handleChange('buddy_name', e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Compensation & Timelines */}
        <Card className="rounded-xl border border-border/80 shadow-xs">
          <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-300" />
              <span>3. Compensation, Joining Date & Terms</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Offer parameters to embed dynamically inside the letter template.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Joining Date *</Label>
              <Input
                type="date"
                value={formData.joining_date}
                onChange={(e) => handleChange('joining_date', e.target.value)}
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{compensationLabel(formData.ctc_frequency)} *</Label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1 min-w-0">
                  <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    placeholder="60000"
                    value={formData.ctc_amount ?? ''}
                    onChange={(e) =>
                      handleChange('ctc_amount', e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="h-9 text-xs rounded-lg pl-7"
                  />
                </div>
                <Select
                  value={formData.ctc_frequency}
                  onValueChange={(val) => handleChange('ctc_frequency', val as CtcFrequency)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg w-[125px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CTC_FREQUENCY_LABELS) as CtcFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {CTC_FREQUENCY_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {compensationDisplay ? (
                  <>
                    Letters will read <strong className="text-foreground">{compensationDisplay}</strong>
                    {formData.ctc_frequency === 'monthly' && annualised ? (
                      <span> · ₹{formatIndianNumber(annualised)} annualised</span>
                    ) : null}
                  </>
                ) : (
                  'Enter the figure and the period it is paid over.'
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Review / Probation Period</Label>
              <Select
                value={formData.probation_period}
                onValueChange={(val) => handleChange('probation_period', val)}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Probation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">No Probation</SelectItem>
                  <SelectItem value="1 Month">1 Month</SelectItem>
                  <SelectItem value="3 Months">3 Months (Standard)</SelectItem>
                  <SelectItem value="6 Months">6 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs font-medium">Core Role Responsibilities</Label>
              <Textarea
                rows={2}
                placeholder="Describe key duties and expected ownership..."
                value={formData.role_responsibilities}
                onChange={(e) => handleChange('role_responsibilities', e.target.value)}
                className="text-xs rounded-lg leading-relaxed"
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. Letter Template Selection & Customization Section */}
        <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                  <span>4. Letters & Document Generation</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Select an applicable template for <strong className="text-foreground">{formData.employee_type_name}</strong> to customize for this candidate.
                </CardDescription>
              </div>
              <Link
                href="/manage/letter-templates"
                target="_blank"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Manage All Templates ↗
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {/* Template Selector Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 p-3 rounded-xl border border-border/80 bg-muted/30">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Select Letter Template</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                    {matchingTemplates.length > 0 ? `${matchingTemplates.length} matching templates` : 'All templates available'}
                  </Badge>
                </Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={(val) => {
                    setSelectedTemplateId(val);
                    setIsLetterCustomized(false);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-card">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(matchingTemplates.length > 0 ? matchingTemplates : templates).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.letter_type} - {t.employee_type_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                onClick={handleUseTemplate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold h-9 px-4 shrink-0 gap-1.5 shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Use Template</span>
              </Button>
            </div>

            {/* Custom Letter Document Editor (when loaded) */}
            {isLetterCustomized ? (
              <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${TONES.success.solid}`}>
                      <Check className="h-3 w-3 mr-1" /> Template Loaded & Mapped
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Edit any term or clause below for this specific candidate:
                    </span>
                  </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const candidateName = formData.candidate_name.trim() || 'Candidate';
                          const dateStr = new Date(formData.joining_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          });
                          try {
                            toast.info(`Generating PDF for ${candidateName}...`);
                            await downloadDocumentAsPdf(
                              `${candidateName} - Offer Letter`,
                              'Offer Letter',
                              customizedLetterContent,
                              { date: dateStr }
                            );
                            toast.success(`Downloaded ${candidateName} Offer Letter.pdf`);
                          } catch (e) {
                            toast.error('Failed to generate PDF');
                          }
                        }}
                        className={`h-7 text-xs rounded-lg font-semibold gap-1 ${TONES.accent.text} ${TONES.accent.border} hover:bg-indigo-500/10`}
                      >
                        <Download className="h-3 w-3" />
                        <span>Download PDF</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewModalOpen(true)}
                        className="h-7 text-xs rounded-lg font-semibold gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Preview Letter</span>
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    rows={14}
                    value={customizedLetterContent}
                    onChange={(e) => setCustomizedLetterContent(e.target.value)}
                    className={`font-mono text-xs rounded-xl p-3 leading-relaxed bg-card ${TONES.accent.border}`}
                    placeholder="Letter content..."
                  />
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-xl text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">No template loaded yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select a template above and click <strong>"Use Template"</strong> to load and customize the candidate's offer or agreement letter.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Dispatch Settings */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-xs">
            <CardContent className="p-4 sm:p-6 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
                  <span>Send Portal Invitation Email Immediately</span>
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When toggled on, an automated welcome email with the unique token link will be dispatched to {formData.personal_email || 'the candidate'}.
                </p>
              </div>
              <Switch
                checked={formData.send_invite_immediately}
                onCheckedChange={(checked) => handleChange('send_invite_immediately', checked)}
              />
            </CardContent>
          </Card>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/onboarding/candidate')}
              className="rounded-lg text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs gap-2 min-w-[170px]"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating Candidate...
                </span>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Save & Create Candidate</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* PREVIEW LETTER MODAL */}
        <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
          <DialogContent
            className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] sm:w-[90vw] h-[90vh] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden"
            style={{ width: '90vw', maxWidth: '90vw', height: '90vh', maxHeight: '90vh' }}
          >
            <DialogHeader className="p-4 border-b border-border/60 bg-muted/20 shrink-0">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                <span>Candidate Letter Preview</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 dark:bg-zinc-900/80">
              <DocumentLetterhead
                date={new Date(formData.joining_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                contentHtml={customizedLetterContent}
              />
            </div>
            <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 shrink-0 gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  const candidateName = formData.candidate_name.trim() || 'Candidate';
                  const dateStr = new Date(formData.joining_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                  try {
                    toast.info(`Generating PDF for ${candidateName}...`);
                    await downloadDocumentAsPdf(
                      `${candidateName} - Offer Letter`,
                      'Offer Letter',
                      customizedLetterContent,
                      { date: dateStr }
                    );
                    toast.success(`Downloaded PDF for ${candidateName}`);
                  } catch (e) {
                    toast.error('Failed to generate PDF');
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs gap-1.5 font-semibold shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-lg text-xs"
              >
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
