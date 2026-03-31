import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { CookieBanner } from '@/components/Legal/CookieBanner';
import { AnimatedLayout } from '@/components/UI/AnimatedLayout';
import './globals.css';

export const metadata: Metadata = {
  title: 'Österreich Events — Entdecke was los ist',
  description: 'Über 40.000 Veranstaltungen in ganz Österreich auf einer interaktiven Karte. Konzerte, Raves, Märkte, Kultur, Sport und mehr.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased">
        <AuthProvider>
          <AnimatedLayout>
            {children}
          </AnimatedLayout>
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
