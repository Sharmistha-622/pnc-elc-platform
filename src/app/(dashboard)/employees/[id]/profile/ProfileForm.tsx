'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  MapPin,
  HeartHandshake,
  ShieldCheck,
  Save,
  CheckCircle2,
  Calendar,
  Clock,
  Mail,
  Building,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createOrUpdateProfile } from '@/lib/profiles/createOrUpdateProfile';
import { EmployeeDetail } from '@/lib/profiles/getProfileData';
import {
  calculateTenure,
  formatEmploymentType,
  formatDate,
} from '@/lib/employees/tenure';
import { toast } from 'sonner';

type LookupOption = { id: string; name: string };

export function ProfileForm({
  employeeId,
  employee,
  existingProfile,
  relationshipTypes,
  idProofTypes,
}: {
  employeeId: string;
  employee: EmployeeDetail | null;
  existingProfile: any;
  relationshipTypes: LookupOption[];
  idProofTypes: LookupOption[];
}) {
  // Pre-fill names from existing profile or split employee.name
  const defaultFirstName =
    existingProfile?.first_name ||
    (employee?.name ? employee.name.split(' ')[0] : '');
  const defaultLastName =
    existingProfile?.last_name ||
    (employee?.name ? employee.name.split(' ').slice(1).join(' ') : '');

  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [personalEmail, setPersonalEmail] = useState(existingProfile?.personal_email || '');
  const [officialEmail, setOfficialEmail] = useState(
    existingProfile?.official_email || employee?.email || ''
  );
  const [contactNumber, setContactNumber] = useState(existingProfile?.contact_number || '');

  // Emergency contact
  const [emergencyContactName, setEmergencyContactName] = useState(
    existingProfile?.emergency_contact_name || ''
  );
  const [emergencyContactNumber, setEmergencyContactNumber] = useState(
    existingProfile?.emergency_contact_number || ''
  );
  const [emergencyContactRelationId, setEmergencyContactRelationId] = useState(
    existingProfile?.emergency_contact_relation_id || ''
  );

  // Address
  const [permanentAddress, setPermanentAddress] = useState(
    existingProfile?.permanent_address || ''
  );
  const [mailingAddressSame, setMailingAddressSame] = useState(
    existingProfile?.mailing_address_same ?? true
  );
  const [mailingAddress, setMailingAddress] = useState(
    existingProfile?.mailing_address || ''
  );

  // Proofs
  const [addressProofTypeId, setAddressProofTypeId] = useState(
    existingProfile?.address_proof_type_id || ''
  );
  const [addressProofNumber, setAddressProofNumber] = useState(
    existingProfile?.address_proof_number || ''
  );
  const [idProofTypeId, setIdProofTypeId] = useState(
    existingProfile?.id_proof_type_id || ''
  );
  const [idProofNumber, setIdProofNumber] = useState(
    existingProfile?.id_proof_number || ''
  );

  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Address sync toggle
  const handleToggleSameAsPermanent = (checked: boolean) => {
    setMailingAddressSame(checked);
    if (checked) {
      setMailingAddress(permanentAddress);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First Name and Last Name are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createOrUpdateProfile({
        employeeId,
        firstName,
        lastName,
        personalEmail,
        officialEmail,
        contactNumber,
        emergencyContactNumber,
        emergencyContactName,
        emergencyContactRelationId: emergencyContactRelationId || undefined,
        permanentAddress,
        mailingAddressSame,
        mailingAddress: mailingAddressSame ? permanentAddress : mailingAddress,
        addressProofTypeId: addressProofTypeId || undefined,
        addressProofNumber,
        idProofTypeId: idProofTypeId || undefined,
        idProofNumber,
      });

      if (res) {
        toast.success('Employee profile updated successfully!');
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 5000);
      } else {
        toast.error('Failed to update profile. Please check database logs.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Unexpected error while saving profile');
    } finally {
      setSubmitting(false);
    }
  }

  const tenureDisplay = calculateTenure(employee?.joining_date, employee?.exit_date);

  return (
    <div className="space-y-6">
      {/* 1. Profile Overview Header Card */}
      {employee && (
        <div className="p-5 rounded-lg border border-border bg-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0 ring-2 ring-indigo-500/20 shadow-xs">
              {employee.name?.charAt(0) || 'U'}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{employee.name}</h2>
                <Badge
                  variant="outline"
                  className="text-xs font-semibold rounded-lg px-2 py-0.5 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                >
                  {formatEmploymentType(employee.employee_type)}
                </Badge>
                {employee.team && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium rounded-lg px-2 py-0.5"
                  >
                    {employee.team}
                  </Badge>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${
                    employee.status?.toLowerCase() === 'confirmed'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  }`}
                >
                  {employee.status || 'Active'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {employee.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span>{employee.email}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>Joined {formatDate(employee.joining_date)}</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Tenure: {tenureDisplay}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {savedSuccess && (
        <div className="p-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
          <p className="font-semibold">
            Employee profile details have been saved and synchronized successfully!
          </p>
        </div>
      )}

      {/* 2. Personal Information Form styled like Onboarding Portal */}
      <form onSubmit={handleSubmit}>
        <Card className="rounded-lg border border-border bg-card shadow-xs animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="size-5 text-indigo-700 dark:text-indigo-300" />
              Personal, Address & Emergency Contact Details
            </CardTitle>
            <CardDescription className="text-xs">
              Permanent address is collected first, followed by current residential or mailing address.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Identity & Basic Contact */}
            <div className="p-4 rounded-lg border border-border/70 bg-muted/10 space-y-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <User className="size-4 text-indigo-700 dark:text-indigo-300" />
                <span>Identity & Basic Contact Details</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    First Name <span className="text-rose-700 dark:text-rose-300">*</span>
                  </Label>
                  <Input
                    className="rounded-lg bg-background"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Last Name <span className="text-rose-700 dark:text-rose-300">*</span>
                  </Label>
                  <Input
                    className="rounded-lg bg-background"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Contact / Phone Number</Label>
                  <Input
                    className="rounded-lg bg-background"
                    value={contactNumber}
                    placeholder="e.g. +91 98765 43210"
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Official Email</Label>
                  <Input
                    type="email"
                    value={officialEmail}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    className="rounded-lg font-mono text-xs bg-background"
                    placeholder="name@example.org"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Personal Email</Label>
                  <Input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    className="rounded-lg font-mono text-xs bg-background"
                    placeholder="personal@gmail.com"
                  />
                </div>
              </div>
            </div>

            {/* Permanent Address Section */}
            <div className="p-4 rounded-lg border border-border/70 bg-muted/10 space-y-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <MapPin className="size-4 text-indigo-700 dark:text-indigo-300" />
                <span>Permanent Address (As per official ID proof)</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Permanent Address Line <span className="text-rose-700 dark:text-rose-300">*</span>
                </Label>
                <Textarea
                  rows={2}
                  className="rounded-lg bg-background"
                  placeholder="House / Flat No, Street, Locality, City, State, Pincode..."
                  value={permanentAddress}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPermanentAddress(val);
                    if (mailingAddressSame) {
                      setMailingAddress(val);
                    }
                  }}
                  required
                />
              </div>
            </div>

            {/* Same as Permanent Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground cursor-pointer">
                  Mailing address is same as permanent address
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle on to automatically mirror permanent address details to current mailing address.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  {mailingAddressSame ? 'Yes' : 'No'}
                </span>
                <Switch
                  checked={mailingAddressSame}
                  onCheckedChange={handleToggleSameAsPermanent}
                />
              </div>
            </div>

            {/* Current / Mailing Address Section (when not same) */}
            {!mailingAddressSame && (
              <div className="p-4 rounded-lg border border-border/70 bg-card space-y-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                  <MapPin className="size-4 text-purple-700 dark:text-purple-300" />
                  <span>Current / Mailing Address</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Mailing Address Line</Label>
                  <Textarea
                    rows={2}
                    className="rounded-lg bg-background"
                    placeholder="Current accommodation, flat/PG, street, city, state..."
                    value={mailingAddress}
                    onChange={(e) => setMailingAddress(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            <div className="p-4 rounded-lg border border-border/70 bg-muted/10 space-y-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <HeartHandshake className="size-4 text-rose-700 dark:text-rose-300" />
                <span>Emergency Contact Person</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Contact Name <span className="text-rose-700 dark:text-rose-300">*</span>
                  </Label>
                  <Input
                    className="rounded-lg bg-background"
                    placeholder="e.g. Suresh Sharma"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Relationship</Label>
                  <Select
                    value={emergencyContactRelationId}
                    onValueChange={(val) => setEmergencyContactRelationId(val)}
                  >
                    <SelectTrigger className="w-full rounded-lg bg-background">
                      <SelectValue placeholder="Select relation" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipTypes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Emergency Phone <span className="text-rose-700 dark:text-rose-300">*</span>
                  </Label>
                  <Input
                    className="rounded-lg bg-background"
                    placeholder="e.g. +91 94140 12345"
                    value={emergencyContactNumber}
                    onChange={(e) => setEmergencyContactNumber(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Identity & Address Proofs */}
            <div className="p-4 rounded-lg border border-border/70 bg-muted/10 space-y-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-300" />
                <span>Identity & Address Proof Documents</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-card rounded-lg border border-border/60 space-y-3">
                  <span className="text-xs font-bold text-foreground">Address Proof</span>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Proof Type</Label>
                    <Select
                      value={addressProofTypeId}
                      onValueChange={(val) => setAddressProofTypeId(val)}
                    >
                      <SelectTrigger className="w-full rounded-lg bg-background">
                        <SelectValue placeholder="Select address proof" />
                      </SelectTrigger>
                      <SelectContent>
                        {idProofTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Document / ID Number</Label>
                    <Input
                      className="rounded-lg bg-background"
                      placeholder="e.g. DL-123456789"
                      value={addressProofNumber}
                      onChange={(e) => setAddressProofNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-card rounded-lg border border-border/60 space-y-3">
                  <span className="text-xs font-bold text-foreground">Identity Proof (Photo ID)</span>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Proof Type</Label>
                    <Select
                      value={idProofTypeId}
                      onValueChange={(val) => setIdProofTypeId(val)}
                    >
                      <SelectTrigger className="w-full rounded-lg bg-background">
                        <SelectValue placeholder="Select ID proof" />
                      </SelectTrigger>
                      <SelectContent>
                        {idProofTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Document / ID Number</Label>
                    <Input
                      className="rounded-lg bg-background"
                      placeholder="e.g. 1234 5678 9012"
                      value={idProofNumber}
                      onChange={(e) => setIdProofNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/50 flex items-center justify-between">
            <Link
              href="/employees"
              className="text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
            >
              <Save className="size-4" />
              <span>{submitting ? 'Saving changes...' : 'Save Profile Changes'}</span>
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}