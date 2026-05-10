/**
 * /create — creator form entry. Server component shell hosts the Client
 * wizard so the wizard can own its state while Next.js still pre-renders
 * the surrounding chrome.
 */

import { CreatorWizard } from '@/components/form/CreatorWizard';
import type { CelebrationType } from '@/lib/supabase/types';

export default function CreatePage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const initialType: CelebrationType | null =
    searchParams.type === 'birthday' || searchParams.type === 'expression' ? searchParams.type : null;

  return (
    <main className="min-h-screen bg-bg-a text-text-primary">
      <CreatorWizard initialType={initialType} />
    </main>
  );
}
