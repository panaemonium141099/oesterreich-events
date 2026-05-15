'use client';

import { Suspense } from 'react';
import { V4PlanWizard } from '@/components/Plans/v4';

function NewPlanInner() {
  // Note: ?event=<id> URL-param could pre-fetch event details, but for
  // Phase 5 v1 we keep the page light — user can find the event via
  // Step 2 search inside the wizard. Future enhancement: server-side
  // fetch event and pass as initialEvent.
  return <V4PlanWizard mode="page"/>;
}

export default function NewPlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--v4-surface)]"/>}>
      <NewPlanInner/>
    </Suspense>
  );
}
