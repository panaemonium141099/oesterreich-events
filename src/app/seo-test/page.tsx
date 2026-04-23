/**
 * DIAGNOSTIC PAGE — safe to delete after Phase 0.5 verification.
 *
 * This page has zero dynamic APIs. No DB calls, no cookies, no headers, no
 * searchParams, no client components. With `export const revalidate = 3600`
 * it MUST render as ISR and ship `public, max-age=0, must-revalidate` +
 * `X-Nextjs-Prerender: 1`.
 *
 * If this page ALSO ships `private, no-store`, something at the platform
 * level is overriding Next.js cache behaviour (Vercel Edge, Firewall, or a
 * project-level Cache-Control rule we haven't found yet).
 */

export const revalidate = 3600;

export default function SeoTestPage() {
  return (
    <main style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>SEO Cache Diagnostic</h1>
      <p>
        Built at: {new Date().toISOString()}
      </p>
      <p>
        If this page ships with <code>Cache-Control: public</code> and
        <code>X-Nextjs-Prerender: 1</code> the Next.js build system is healthy.
      </p>
      <p>
        If it ships with <code>Cache-Control: private, no-store</code> the
        problem is platform-level (Vercel Edge, project config, or a middleware).
      </p>
    </main>
  );
}
