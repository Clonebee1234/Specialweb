/**
 * /create/confirmation — shown after a successful POST to /api/celebrations.
 *
 * The creator's submit-result lives in sessionStorage (inside the Zustand
 * store). If the user lands here without a fresh submit result, we redirect
 * them back to /create.
 */

import { ConfirmationScreen } from '@/components/form/ConfirmationScreen';

export default function ConfirmationPage() {
  return (
    <main className="min-h-screen bg-bg-a text-text-primary">
      <ConfirmationScreen />
    </main>
  );
}
