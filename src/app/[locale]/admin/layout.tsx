import { AdminSidebar } from '@/components/Admin/AdminSidebar';
import { AppShell } from '@/components/Layout/AppShell';

export const metadata = { title: 'Admin Panel' };

/**
 * /admin — admin panel. Authenticated-only; AdminSidebar reads the
 * profile role (god/admin) via useAuth. fn-15.5 (Bundle-Architektur):
 * wraps in AppShell to provide AuthProvider + saved-events + toasts
 * locally, with the floating bottom social-nav hidden because the
 * admin sidebar provides its own navigation.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell hideSocialNav>
      {/* flex-col auf Mobile: die AdminSidebar rendert dort eine sticky
          Menü-Leiste im Fluss (über dem Inhalt), erst ab lg die statische
          Seitenleiste neben dem Inhalt. */}
      <div className="min-h-screen bg-black text-white flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </AppShell>
  );
}
