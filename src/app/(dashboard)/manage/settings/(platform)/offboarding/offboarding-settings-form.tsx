'use client';

import React, { useState, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Laptop,
  FileCheck2,
  Banknote,
  RotateCcw,
} from 'lucide-react';
import { OffboardingSettings } from '@/lib/offboarding/types';
import { updateOffboardingSettings } from '@/lib/offboarding/service';
import { toast } from 'sonner';

export function OffboardingSettingsForm({
  initialSettings,
}: {
  initialSettings: OffboardingSettings;
}) {
  const [settings, setSettings] = useState<OffboardingSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateOffboardingSettings(settings);
      if (res.success) {
        setSavedSuccess(true);
        toast.success('Offboarding policy settings saved successfully');
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        toast.error(res.error || 'Failed to update offboarding settings');
      }
    });
  };

  const handleResetDefaults = () => {
    setSettings({
      default_notice_period_days: 30,
      standard_fnf_timeline_days: 30,
      standard_hold_period_days: 7,
      clearance_reminder_frequency_days: 2,
      escalation_threshold_days: 5,
      require_all_ndc_before_fnf: true,
      require_asset_clearance_before_closure: true,
      allow_immediate_relieving: true,
    });
    toast.info('Settings reset to organization defaults. Click Save to persist.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Timelines & Notice Periods */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-base font-semibold">
                  Notice Periods & Payout Timelines
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Configure standard notice periods, F&F settlement SLA, and reminder frequency.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              SLA Policies
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Default Notice Period (Days)
              </Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={settings.default_notice_period_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_notice_period_days: parseInt(e.target.value) || 0,
                  })
                }
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Standard contractual notice period duration applied when calculating proposed LWD.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Standard F&F Settlement Timeline (Days from LWD)
              </Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={settings.standard_fnf_timeline_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    standard_fnf_timeline_days: parseInt(e.target.value) || 30,
                  })
                }
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Target turnaround for disbursement of final dues following the employee’s last working day.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Retention Hold Window (Days)
              </Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.standard_hold_period_days || 7}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    standard_hold_period_days: parseInt(e.target.value) || 7,
                  })
                }
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Duration for Manager & P&C retention discussion window before requiring final resolution (Default: 7 days).
              </p>
            </div>


            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Clearance Reminder Frequency (Days)
              </Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={settings.clearance_reminder_frequency_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    clearance_reminder_frequency_days: parseInt(e.target.value) || 2,
                  })
                }
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Cadence at which the automated reminder engine checks and alerts owners of pending checkpoints.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Manager Escalation Window (Days Before LWD)
              </Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={settings.escalation_threshold_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    escalation_threshold_days: parseInt(e.target.value) || 5,
                  })
                }
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Days remaining before LWD when incomplete items are highlighted in urgent priority.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Clearance Governance & Enforcement */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-emerald-700 dark:text-emerald-400" />
                <CardTitle className="text-base font-semibold">
                  Clearance Gates & Governance Rules
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Define mandatory gates required before computing F&F and closing employee separation.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Compliance Rules
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60">
            <div className="space-y-1 max-w-xl">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Banknote className="size-4 text-muted-foreground" />
                Require Complete NDC Prior to F&F Settlement
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When enabled, Finance cannot mark Full & Final settlement as processed until all four
                departmental sign-offs (Manager, IT, Finance, P&C) are marked as Cleared.
              </p>
            </div>
            <Switch
              checked={settings.require_all_ndc_before_fnf}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, require_all_ndc_before_fnf: checked })
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60">
            <div className="space-y-1 max-w-xl">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Laptop className="size-4 text-muted-foreground" />
                Strict Asset Return Enforcement Before Official Exit Closure
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Prevents marking an employee as officially Exited in the directory if any assigned hardware
                or IT asset is still pending physical return or recovery exception approval.
              </p>
            </div>
            <Switch
              checked={settings.require_asset_clearance_before_closure}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  require_asset_clearance_before_closure: checked,
                })
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4 py-2">
            <div className="space-y-1 max-w-xl">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="size-4 text-muted-foreground" />
                Allow Immediate Relieving & Notice Period Waiver
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Permits authorized P&C admins to initiate or approve accelerated exits with zero notice period
                under approved medical, mutual, or contractual exception policies.
              </p>
            </div>
            <Switch
              checked={settings.allow_immediate_relieving}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  allow_immediate_relieving: checked,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetDefaults}
          disabled={isPending}
          className="text-xs gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          Reset Defaults
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
        >
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </>
          ) : savedSuccess ? (
            <>
              <CheckCircle2 className="size-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="size-3.5" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
