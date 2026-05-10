/** /admin dashboard — the main admin workspace. */

import { AdminPanel } from '@/components/admin/AdminPanel';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-bg-a text-text-primary">
      <AdminPanel />
    </main>
  );
}
