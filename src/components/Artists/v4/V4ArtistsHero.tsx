/**
 * V4ArtistsHero — RSC hero for /artists. Eyebrow + headline (Inter +
 * Fraunces italic accent) + subtitle. No search input here — the
 * V4ArtistSearchResult component below owns the input.
 */

export function V4ArtistsHero() {
  return (
    <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-16">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <div className="max-w-[920px]">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3.5 md:mb-5">
            Lieblingskünstler · Such &amp; Folge
          </p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            Such einen Künstler. Wir sagen Bescheid, wenn er in Österreich spielt.
          </h1>
          <p className="text-[14px] md:text-[15.5px] text-[var(--v4-ink-70)] mt-3.5 md:mt-5 max-w-[600px] leading-[1.55]">
            Konzerte, Open Airs und Festival-Slots — alles drin.
          </p>
        </div>
      </div>
    </section>
  );
}
