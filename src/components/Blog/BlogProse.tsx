import { parseProse } from '@/lib/blog/prose';

/**
 * Mehrabsätzige Prosa eines Blogposts (history, whatToExpect): Absätze,
 * `## Zwischentitel` und `**fett**`. Serverkomponente ohne Zustand.
 */
export default function BlogProse({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseProse(text);
  if (blocks.length === 0) return null;
  return (
    <div className={className}>
      {blocks.map((b, i) =>
        b.type === 'heading' ? (
          <h3 key={i} className="text-lg md:text-xl font-bold text-gray-900 tracking-tight mt-8 mb-3 first:mt-0">
            {b.text}
          </h3>
        ) : (
          <p key={i} className="text-gray-600 leading-relaxed text-lg mb-5 last:mb-0">
            {b.runs.map((r, j) =>
              r.bold ? <strong key={j} className="font-semibold text-gray-900">{r.text}</strong> : <span key={j}>{r.text}</span>,
            )}
          </p>
        ),
      )}
    </div>
  );
}
