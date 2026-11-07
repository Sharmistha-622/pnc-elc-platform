'use client';

import React, { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyOnboardingDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  // The review console is addressed by the record id.
  useEffect(() => {
    router.replace(`/onboarding/review/${id}`);
  }, [id, router]);

  return (
    <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground font-medium">
      Redirecting to candidate review console...
    </div>
  );
}
