/**
 * V4EventDetailContent — the main content column of the event detail.
 *
 * Phase 3 keeps the structure minimal and forward-compatible:
 *   • Description block (h3 "Worum geht's?" + paragraph)
 *   • Tag chips (neutral hairline pills)
 *   • #similar-events anchor + section header (caller renders the actual
 *     similar-event grid; we just provide the landing target for the
 *     soldout box scroll-CTA)
 *
 * Lineup grid + venue map snippet are explicit follow-ups (Phase 3.1)
 * since they need their own data wiring and would balloon this file.
 */

import type { ReactNode } from 'react';

interface V4EventDetailContentProps {
  description: string | null;
  tags?: string[] | null;
  hasSimilar?: boolean;
  similarChildren?: ReactNode;
}

export function V4EventDetailContent({ description, tags, hasSimilar, similarChildren }: V4EventDetailContentProps) {
  const tagList = (tags ?? []).filter(Boolean);

  return (
    <div className="max-w-[700px]">
      {description && (
        <section className="mt-7">
          <h3 className="m-0 mb-3 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            Worum geht&apos;s?
          </h3>
          <p className="m-0 max-w-[640px] text-[14.5px] leading-[1.6] text-[var(--v4-ink-70)]" style={{ textWrap: 'pretty' }}>
            {description}
          </p>
        </section>
      )}

      {tagList.length > 0 && (
        <section className="mt-7 flex flex-wrap gap-2">
          {tagList.map(t => (
            <span
              key={t}
              className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--v4-hairline-2)] text-[11.5px] font-medium text-[var(--v4-ink-70)]"
            >
              {t}
            </span>
          ))}
        </section>
      )}

      {hasSimilar && (
        <section id="similar-events" className="mt-10">
          <h3 className="m-0 mb-4 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            Ähnliche Events
          </h3>
          {similarChildren}
        </section>
      )}
    </div>
  );
}
