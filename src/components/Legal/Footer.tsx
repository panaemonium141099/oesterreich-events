import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-white/[0.06] mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} Österreich Events. Alle Rechte vorbehalten.
        </p>
        <nav className="flex items-center gap-6">
          <Link href="/blog" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Blog
          </Link>
          <Link href="/impressum" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Datenschutz
          </Link>
          <Link href="/agb" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            AGB
          </Link>
          <a href="mailto:dev@glatzdev.com" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Kontakt
          </a>
        </nav>
      </div>
    </footer>
  );
}
