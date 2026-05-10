/**
 * /c/[shortCode] — recipient entry point.
 *
 * Server component: we fetch the row server-side, run the lifecycle gate,
 * and either render a static gate screen (pending, pre-activation, ended,
 * not-found) or mount the Client `RecipientExperience` for the active case.
 *
 * This split matters because the gate screens must NEVER pull in the
 * experience bundle — we don't want photos, messages, quiz questions, or
 * anything else to leak through "view source".
 */

import { notFound } from 'next/navigation';
import { findByShortCode } from '@/lib/db/celebrations';
import { gate } from '@/lib/lifecycle';
import { RecipientExperience } from '@/components/experience/RecipientExperience';

export const dynamic = 'force-dynamic';

export default async function RecipientPage({ params }: { params: { shortCode: string } }) {
  const row = await findByShortCode(params.shortCode);
  if (!row) notFound();

  const g = gate({
    status: row.status,
    now: new Date(),
    activate_at: new Date(row.activate_at),
    expires_at: new Date(row.expires_at),
  });

  if (g.state === 'not_found') notFound();

  if (g.state === 'pending') {
    return <GateScreen title="This surprise is still being prepared." subtitle="Check back soon 💛" />;
  }
  if (g.state === 'ended') {
    return (
      <GateScreen
        title="This celebration has ended."
        subtitle="The memories live on 💫. Screen record next time!"
      />
    );
  }
  if (g.state === 'pre_activation' && g.activate_at) {
    return (
      <GateScreen
        title="This celebration hasn't started yet."
        subtitle={`Come back at ${g.activate_at.toLocaleString()} 💛`}
      />
    );
  }

  // active
  return <RecipientExperience shortCode={row.short_code} />;
}

function GateScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-a px-6 text-center text-text-primary">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-text-muted">{subtitle}</p>
      </div>
    </main>
  );
}
