'use client';

import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-center relative overflow-hidden px-4"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), #000',
      }}
    >
      {/* Back to landing */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        <span className="hidden sm:inline">Zurück</span>
      </Link>

      {/* Branding */}
      <div
        className="mb-8 text-center animate-fade-in opacity-0"
        style={{ animationDelay: '0.05s', animationFillMode: 'forwards' }}
      >
        <p className="text-xs tracking-[0.3em] uppercase text-white/40 font-medium">
          Österreich Events
        </p>
        <div className="w-8 h-px bg-white/20 mx-auto mt-3" />
      </div>

      {/* Content card */}
      <div
        className="w-full max-w-md animate-fade-in-up opacity-0"
        style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}
      >
        {children}
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}
