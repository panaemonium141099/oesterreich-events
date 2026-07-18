import { fraunces, caveat } from '@/lib/fonts-planer';
// fn-15.6: planer-scope CSS (cinematic editorial chrome — .planer-scope,
// magnetic-cta, kinetic-underline, hairline-accent, rising-type, etc.)
// was extracted from globals.css and lives in src/app/planer-scope.css.
// Importing it here means it only ships under /groups (and child
// segments like /groups/[id]) — the landing/blog/event pages no
// longer carry ~6 KB of editorial chrome in their critical CSS chunk.
import '../planer-scope.css';

/**
 * /groups parent layout — mounts the Planer-scope fonts.
 *
 * fn-15.5 round-12 (codex): NO AppShell here. Parent layouts in the
 * App Router wrap every child segment, so mounting AppShell at this
 * level forced /groups/[id] (plan detail, which has its own minimal
 * provider needs) to also pay for the full social shell. The list
 * route /groups/page.tsx now mounts AppShell directly, and
 * /groups/[id]/layout.tsx mounts its own ModalShell.
 *
 * fn-15.8: Fraunces (Editorial Serif) + Caveat (Post-it Handwriting)
 * mount here as CSS vars on a wrapping <div>. Sub-routes (`/groups`
 * list and `/groups/[id]` detail) both render `.planer-scope`
 * chrome, which consumes `--font-display` (Fraunces) and
 * `--font-caveat` directly. Anchoring on the shared parent layout
 * means the font CSS only lands on routes under `/groups/*`.
 */
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${caveat.variable}`}>
      {children}
    </div>
  );
}
