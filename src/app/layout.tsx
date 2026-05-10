import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'CelebrateThem',
  description: 'Make someone feel truly seen.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-a text-text-primary antialiased">{children}</body>
    </html>
  );
}
