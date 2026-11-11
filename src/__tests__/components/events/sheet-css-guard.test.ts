import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Wächter für das Bottom-Sheet-CSS (globals.css): Nach der Einblendung
 * darf am Sheet KEIN Transform mehr stehen. Ein transformiertes Element
 * ist der Bezugsrahmen für `position: fixed`-Nachfahren — mit
 * `animation-fill-mode: both` blieb `translate3d(0,0,0)` am Event-Sheet
 * kleben, und die Ticketleiste (V4MobileStickyBar) scrollte im Sheet mit
 * nach oben statt am Viewport zu haften (Mobile-Audit 2026-10-22).
 */
describe('globals.css — [data-sheet-state] hinterlässt keinen Transform', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/[locale]/globals.css'), 'utf8');

  it('Einblendung endet ohne Fill-Mode `both`/`forwards`', () => {
    const rule = css.match(/\[data-sheet-state='open'\]\s*\{[^}]*animation:[^;]*;/)?.[0] ?? '';
    expect(rule).toContain('sheet-slide-in');
    expect(rule).not.toMatch(/\b(both|forwards)\b/);
  });

  it('Reduced-Motion-Variante setzt keinen Transform auf das offene Sheet', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce) {\n  /* fn-15.5 round-11'));
    const rule = reduced.match(/\[data-sheet-state='open'\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('animation: none');
    expect(rule).not.toMatch(/transform:\s*translate/);
  });
});
