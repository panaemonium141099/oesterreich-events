/**
 * BlogStayList — kuratierte Unterkünfte in "Übernachten"-Artikeln (fn-21).
 *
 * Rendert die post.stays-Liste als Karten: Name + Region-Badge + Beschreibung,
 * CTA führt per CJ-Affiliate-Deeplink auf die Booking.com-Suche nach
 * "<Name> <Ort>" (sid=stay-article-<slug>). Reine Links, kein Fremd-Script.
 * Kennzeichnung analog BlogTicketBox ("Anzeige" + Disclosure).
 */

import { buildAffiliateStayLink } from '@/lib/booking/affiliate';
import type { FestivalPost } from '@/content/blog/types';

export function BlogStayList({ post }: { post: FestivalPost }) {
  const stays = post.stays;
  if (!stays || stays.length === 0) return null;

  return (
    <section className="mb-14 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
          Die Unterkünfte im Überblick
        </p>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
          Anzeige
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {stays.map((stay) => {
          const href = buildAffiliateStayLink(
            { ss: `${stay.name} ${stay.place}` },
            `stay-article-${post.slug}`,
          );
          return (
            <div key={stay.name} className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{stay.name}</p>
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                    {stay.kind}
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
                  {stay.place} · {stay.region}
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">{stay.description}</p>
              </div>
              <a
                href={href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                data-track="stay_click"
                data-track-id={`${post.slug}:${stay.place}`}
                data-track-provider="booking"
                className="inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-xs whitespace-nowrap shrink-0 sm:mt-1"
              >
                Verfügbarkeit prüfen
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Affiliate-Links: Der Button öffnet die Booking.com-Suche nach der
          jeweiligen Unterkunft. Buchst du darüber, erhält LassTreffen.at eine
          Provision — am Preis ändert sich für dich nichts. Ist eine Unterkunft
          dort nicht gelistet, zeigt Booking.com Alternativen in der Nähe.
        </p>
      </div>
    </section>
  );
}
