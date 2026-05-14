const STEPS = [
  { n: '01', t: 'Künstler folgen', s: 'Such und folge deine Lieblingskünstler. Wir scannen Konzerte und Festival-Slots in Österreich.' },
  { n: '02', t: 'Tickets sichern', s: 'Wenn ein Auftritt auftaucht, springst du direkt zum offiziellen Ticketshop. Kauf erfolgt beim Anbieter.' },
  { n: '03', t: 'Abend planen',    s: 'Speichere Ticketstatus, Anreise und Reminder in deinem Plan. Drei Pings reichen meistens.' },
];

export function HowItWorks() {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="mb-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          So geht's
        </p>
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
          In drei Schritten unterwegs
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--v4-hairline-1)] rounded-[18px] p-px overflow-hidden">
        {STEPS.map(s => (
          <div key={s.n} className="bg-[var(--v4-surface-elevated)] p-5 md:p-7 rounded-[17px]">
            <div className="text-[30px] mb-3.5" style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--v4-ink-50)', letterSpacing: '-0.02em' }}>
              {s.n}
            </div>
            <div className="text-[17px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] mb-2">{s.t}</div>
            <div className="text-[13px] text-[var(--v4-ink-70)] leading-snug max-w-[36ch]">{s.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
