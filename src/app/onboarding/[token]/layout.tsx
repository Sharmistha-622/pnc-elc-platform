import React from 'react';
import Image from 'next/image';
import { ModeToggle } from '@/components/mode-toggle';
import packageJson from '../../../../package.json';
import { PrivacyContact } from '@/components/shared/privacy/privacy-contact';
import { getPortalPrivacySettings } from '@/lib/dpdp/portal';

export const metadata = {
  title: 'Candidate Onboarding | NavGurukul',
  description: 'Welcome to NavGurukul. Complete your onboarding paperwork, documents, and policies.',
};

export default async function CandidateOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The published business contact (DPDP Act s. 8(9)): the same for every candidate.
  const privacy = await getPortalPrivacySettings();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Candidate Portal Top Navigation Bar (matching app site-header height & background) */}
      <header className="bg-sidebar sticky top-0 z-40 flex w-full items-center border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Image
              src="/ng-icon.png"
              alt="NavGurukul Logo"
              width={32}
              height={32}
              className="size-8 rounded-lg object-contain"
              priority
            />
            <div>
              <span className="font-bold text-sm text-foreground tracking-tight block leading-tight">
                NavGurukul
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                Candidate Onboarding Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline-block">
              Need help? <a href="mailto:pnc@navgurukul.org" className="text-indigo-600 dark:text-indigo-400 hover:underline">pnc@navgurukul.org</a>
            </span>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start w-full">
        {children}
      </main>

      {/* Candidate Footer */}
      <footer className="border-t border-border bg-card py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="space-y-1 text-left">
            <p>© {new Date().getFullYear()} NavGurukul Foundation for Social Welfare. All rights reserved.</p>
            <PrivacyContact variant="footer" contact={privacy.contact} grievanceDays={privacy.grievance_days} />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">NG-ELC Lifecycle Engine v{packageJson.version}</span>
        </div>
      </footer>
    </div>
  );
}
