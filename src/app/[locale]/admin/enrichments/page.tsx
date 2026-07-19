import EnrichmentsClient from './EnrichmentsClient';

// Force fresh SSR on every request. Without this, Vercel's edge cached the
// pre-deploy not-found response for this path and kept serving it after the
// route shipped. Admin pages have nothing worth caching anyway.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Enrichments | Admin' };

export default function Page() {
  return <EnrichmentsClient />;
}
