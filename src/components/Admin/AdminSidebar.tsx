'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  ShieldCheck,
  GitMerge,
  Database,
  Calendar,
  Users,
  BarChart3,
  Shield,
  ClipboardCheck,
  LineChart,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, href: '/admin/overview' },
  { label: 'Scraper Runs', icon: Activity, href: '/admin/scraper-runs' },
  { label: 'Quality', icon: ShieldCheck, href: '/admin/quality' },
  { label: 'Dedup', icon: GitMerge, href: '/admin/dedup' },
  { label: 'Review Queue', icon: ClipboardCheck, href: '/admin/review' },
  { label: 'Source Trust', icon: Shield, href: '/admin/source-trust' },
  { label: 'Quality Stats', icon: BarChart3, href: '/admin/quality-stats' },
  { label: 'Sources', icon: Database, href: '/admin/sources' },
  { label: 'Events', icon: Calendar, href: '/admin/events' },
  { label: 'Users', icon: Users, href: '/admin/users' },
  { label: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
  // SEO KPI dashboard — fn-13 phase 10. Pulls GSC + CrUX + internal.
  { label: 'SEO', icon: LineChart, href: '/admin/seo' },
  { label: 'Moderation', icon: Shield, href: '/admin/moderation' },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-60 bg-black/50 border-r border-white/[0.06]
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white/80 tracking-wide uppercase">
            Admin Panel
          </span>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1 text-white/50 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                  ${active
                    ? 'text-amber-400 border-l-2 border-amber-400 bg-amber-400/[0.05]'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03] border-l-2 border-transparent'
                  }
                `}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="border-t border-white/[0.06] p-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.03]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
        </div>
      </aside>
    </>
  );
}
