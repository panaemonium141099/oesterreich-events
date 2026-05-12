/**
 * /groups/[id] — authenticated plan detail.
 *
 * fn-15.5 (round-3 codex fix): hides the bottom social-nav rendered by
 * the parent `/groups/layout.tsx`'s <AppShell>. We can't nest a second
 * <AppShell> (codex round-1 finding: double provider tree), and a
 * client-only useEffect (round-2 attempt) hid the nav only after
 * hydration — slow devices flashed the wrong UI and the fixed nav
 * could intercept taps before JS arrived.
 *
 * This layout is a server component now: it ships a tiny inline
 * `<style>` tag in the SSR HTML that hides any `[data-social-nav]`
 * sibling. When the user navigates away, this segment unmounts and the
 * style tag goes with it — no body-attribute cleanup, no hydration
 * flash, no double provider tree.
 */

export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        // The selector targets ANY [data-social-nav] in the document,
        // not just descendants of this layout — the parent's <SocialNav>
        // lives in a sibling slot.
        dangerouslySetInnerHTML={{
          __html: '[data-social-nav]{display:none!important}',
        }}
      />
      {children}
    </>
  );
}
