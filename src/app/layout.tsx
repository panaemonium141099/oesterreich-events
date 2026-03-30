import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/supabase/auth-context';
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
          <div className="animate-fade-in" style={{ animationDuration: '200ms' }}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
