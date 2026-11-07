import React from 'react';
import { getOffboardingSettings } from '@/lib/offboarding/service';
import { OffboardingSettingsForm } from './offboarding-settings-form';

export const dynamic = 'force-dynamic';

export default async function OffboardingSettingsPage() {
  const settings = await getOffboardingSettings();

  return (
    <div className="space-y-6">
      <OffboardingSettingsForm initialSettings={settings} />
    </div>
  );
}
