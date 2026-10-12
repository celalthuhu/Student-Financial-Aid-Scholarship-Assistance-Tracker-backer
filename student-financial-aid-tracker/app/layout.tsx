import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Student Financial Aid & Scholarship Assistance Tracker',
  description: 'Student and administrator portal for financial aid and scholarship assistance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-ink antialiased">{children}</body>
    </html>
  );
}
