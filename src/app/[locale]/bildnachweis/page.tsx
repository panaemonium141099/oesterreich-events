import type { Metadata } from 'next';
import credits from '@/content/image-credits.json';

export const metadata: Metadata = {
  title: 'Bildnachweis',
  description:
    'Quellen und Lizenzen der Bundesland- und Regionsbilder auf LassTreffen.at.',
  robots: { index: false, follow: true },
};

interface Credit {
  slug: string;
  bl: string | null;
  name: string | null;
  title: string;
  creator: string;
  license: string;
  license_url: string;
  source: string;
}

export default function BildnachweisPage() {
  const items = credits as Credit[];
  return (
    <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">Bildnachweis</h1>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[var(--v4-ink-70)]">
          Die Vorschaubilder der Bundesländer und Regionen stammen aus Wikimedia
          Commons und wurden über Openverse bezogen. Alle stehen unter einer
          Creative-Commons-Lizenz — Urheber und Lizenz sind je Bild gelistet.
        </p>
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.slug} className="border-t border-[var(--v4-hairline-2)] pt-3 text-sm">
              <span className="font-semibold">{c.name ?? c.bl ?? c.slug}</span>
              {' — '}
              <span className="text-[var(--v4-ink-70)]">{c.title || 'Foto'}</span>
              {c.creator ? <> · {c.creator}</> : null}
              {' · '}
              {c.license_url ? (
                <a href={c.license_url} className="underline" target="_blank" rel="noopener noreferrer nofollow">
                  CC {c.license}
                </a>
              ) : (
                <span>CC {c.license}</span>
              )}
              {c.source ? (
                <>
                  {' · '}
                  <a href={c.source} className="underline" target="_blank" rel="noopener noreferrer nofollow">
                    Quelle
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
