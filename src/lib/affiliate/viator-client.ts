/**
 * Viator-Partner-API-Client (Basic Access) — fn-18 Task 5.
 *
 * ============================ NUTZUNGSBEDINGUNGEN ==========================
 * Verbindliche Auflagen aus den Viator-API-Nutzungsbedingungen (Stand
 * 2026-07-31). Sie sind KEIN Stilhinweis, sondern Vertragspflichten:
 *
 *  (1) KEINE INDEXIERUNG VIATOR-SPEZIFISCHER INHALTE.
 *      Produkttitel, Beschreibungen, Bilder und Preise duerfen nicht in
 *      das serverseitig gerenderte HTML einer von Suchmaschinen
 *      indexierbaren Seite gelangen. Deshalb ist die Anzeige-Komponente
 *      (components/Activities/BookingBox.tsx) eine CLIENT-Komponente, die
 *      ihre Daten erst im Browser ueber /api/activities/[id]/booking holt;
 *      diese Route traegt `X-Robots-Tag: noindex, nofollow`. Die
 *      Aktivitaetsseite selbst bleibt regulaer indexierbar.
 *  (2) Viator-Inhalte duerfen ausschliesslich auf der EIGENEN Domain
 *      (lasstreffen.at) ausgespielt und NICHT an Dritte weitergegeben
 *      werden — keine Aufnahme in oeffentliche Feeds/Exporte/Sitemaps,
 *      keine Weitergabe an Partner-APIs.
 *  (3) Kein Cross-Bidding auf "Viator"-Markenkeywords (SEA/Marketing —
 *      betrifft keinen Code, hier nur als Merker dokumentiert).
 *  (4) Affiliate-Links: `rel="sponsored nofollow"` (Google-Pflicht) +
 *      sichtbare Kennzeichnung als Werbung/Provisionslink (EU/AT).
 *
 * ============================ CACHING-POLITIK ==============================
 * Epic-Beschluss "Affiliate-Fakten" (verbindlich):
 *  - Produkt-STAMMDATEN (product_code, Titel, Teaser, Bild) duerfen lokal
 *    in poi_activities.affiliate_product gespeichert werden; Refresh
 *    taeglich per GitHub-Action (.github/workflows/refresh-viator.yml) —
 *    NICHT als Vercel-Cron (Masterplan-Linie: Imports weg von Vercel).
 *  - PREISE/VERFUEGBARKEIT sind kurzlebig: Anzeige nur als "ab X EUR" mit
 *    sichtbarem Hinweis "Preis kann abweichen", taeglicher Refresh.
 *  - TODO(viator-onboarding): Die exakten VERTRAGLICHEN TTLs stehen erst
 *    nach dem Partner-Onboarding fest. Sobald verifiziert, die beiden
 *    Konstanten MASTER_DATA_TTL_HOURS / PRICE_TTL_HOURS unten auf die
 *    vertraglichen Werte setzen und die Fundstelle hier referenzieren.
 *
 * ============================ TECHNIK ======================================
 * Verifiziert: Auth-Header `exp-api-key`, Base https://api.viator.com/partner,
 * Basic-Access-Endpoints /products/search, /products/{code},
 * /availability/schedules; Rate-Limit ~150 Requests / 10 s rollierend.
 *
 * GRACEFUL DEGRADATION (Pflicht): Fehlt VIATOR_API_KEY, wirft dieser Client
 * NICHT — er liefert leere Ergebnisse. Weder Seiten noch Jobs duerfen an
 * einem fehlenden Key kaputtgehen.
 */

import { RateLimitQueue } from './rate-limit-queue';
import type { AffiliateProduct } from './viator-types';

export const VIATOR_API_BASE = 'https://api.viator.com/partner';

/** Rollierendes Rate-Limit des Basic Access (bewusst mit Sicherheitsabstand). */
export const VIATOR_RATE_LIMIT = 140;
export const VIATOR_RATE_WINDOW_MS = 10_000;

/** Siehe Caching-Politik oben — Stammdaten taeglich. */
export const MASTER_DATA_TTL_HOURS = 24;
/** Siehe Caching-Politik oben — Preise kurzlebig, taeglicher Refresh + Hinweis. */
export const PRICE_TTL_HOURS = 24;

/** Basic Access spricht v2.0 (Accept-Header ist Pflicht). */
const ACCEPT_HEADER = 'application/json;version=2.0';

/**
 * Freitext-Suchpfad. Der Epic nennt `/products/search` als Basic-Scope;
 * die Freitext-Variante heisst in der v2-Doku `/search/freetext`. Welcher
 * Pfad fuer unseren Key freigeschaltet ist, laesst sich ohne Key nicht
 * verifizieren — daher per Env umschaltbar.
 * TODO(viator-onboarding): Nach Freischaltung den funktionierenden Pfad
 * verifizieren und ggf. VIATOR_SEARCH_PATH in GitHub-Actions-Secrets setzen.
 * Beide Response-Shapes (products.results / data) werden geparst.
 */
export const VIATOR_SEARCH_PATH_DEFAULT = '/search/freetext';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
/** Kappung absurder Retry-After-Werte. */
const MAX_RETRY_AFTER_SECONDS = 60;

/**
 * Deeplink-Template. Das exakte pid-/Kampagnen-Format ist OHNE Zugriff
 * auf das Partner-Portal NICHT verifizierbar (docs.viator.com/partner-api/
 * affiliate/technical/ ist hinter Login) — deshalb vollstaendig ueber Env
 * konfigurierbar statt geraten hart verdrahtet.
 *
 * TODO(viator-onboarding): Nach Freischaltung im Partner-Portal das
 * dokumentierte Deeplink-Format pruefen und, falls es abweicht,
 * VIATOR_DEEPLINK_TEMPLATE / VIATOR_PARTNER_ID / VIATOR_DEEPLINK_PARAMS
 * in Vercel-Env UND GitHub-Actions-Secrets setzen (beide Stores!).
 * Solange VIATOR_PARTNER_ID leer ist, wird KEIN pid angehaengt — der Link
 * funktioniert dann, verdient aber nichts.
 */
export const VIATOR_DEEPLINK_TEMPLATE_DEFAULT = 'https://www.viator.com/tours/{productCode}';
/** Query-Parameter-Name der Partner-ID (per Env ueberschreibbar). */
export const VIATOR_PID_PARAM_DEFAULT = 'pid';

export interface ViatorProduct {
  productCode: string;
  title: string | null;
  teaser: string | null;
  imageUrl: string | null;
  priceFrom: number | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Von Viator geliefertes productUrl, falls vorhanden. */
  productUrl: string | null;
  /** Ort/Destination als Freitext (fuer das Matching). */
  locationText: string | null;
}

export interface ViatorSearchOptions {
  /** Freitext (Aktivitaetsname, ggf. + Ort). */
  searchTerm: string;
  /** Max. Treffer (Viator-Basic erlaubt kleine Seiten; wir brauchen wenige). */
  limit?: number;
  currency?: string;
}

export interface ViatorClient {
  /** true, sobald ein API-Key konfiguriert ist. */
  readonly enabled: boolean;
  searchProducts(options: ViatorSearchOptions): Promise<ViatorProduct[]>;
  getProduct(productCode: string): Promise<ViatorProduct | null>;
  /** Kurzlebige Preis/Verfuegbarkeits-Info (nur "ab"-Preis wird verwendet). */
  getPriceFrom(productCode: string): Promise<{ price: number; currency: string } | null>;
}

export function isViatorConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return typeof env.VIATOR_API_KEY === 'string' && env.VIATOR_API_KEY.trim() !== '';
}

/* ------------------------------------------------------------------ */
/* Deeplink                                                            */
/* ------------------------------------------------------------------ */

export interface DeeplinkInput {
  productCode: string;
  /** Falls die API ein productUrl liefert, hat es Vorrang vor dem Template. */
  productUrl?: string | null;
  partnerId?: string | null;
  /** Template mit {productCode}-Platzhalter. */
  template?: string | null;
  /** Name des pid-Query-Parameters. */
  pidParam?: string | null;
  /** Zusaetzliche Query-Parameter als Rohstring, z. B. "mcid=42383&medium=api". */
  extraParams?: string | null;
}

/**
 * Baut den Affiliate-Deeplink. Deterministisch und ohne Netzzugriff
 * (deshalb testbar). Ohne partnerId entsteht ein gueltiger, aber
 * unattributierter Link — nie ein kaputter.
 */
export function buildViatorDeeplink(input: DeeplinkInput): string {
  const code = input.productCode.trim();
  const template = (input.template ?? '').trim() || VIATOR_DEEPLINK_TEMPLATE_DEFAULT;

  const raw = (input.productUrl ?? '').trim();
  const base =
    raw && /^https?:\/\//i.test(raw)
      ? raw
      : template.replace('{productCode}', encodeURIComponent(code));

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    // Kaputtes Template/productUrl -> Default-Template, nie ein Throw.
    url = new URL(VIATOR_DEEPLINK_TEMPLATE_DEFAULT.replace('{productCode}', encodeURIComponent(code)));
  }

  const pid = (input.partnerId ?? '').trim();
  if (pid) {
    const param = (input.pidParam ?? '').trim() || VIATOR_PID_PARAM_DEFAULT;
    url.searchParams.set(param, pid);
  }

  const extra = (input.extraParams ?? '').trim().replace(/^[?&]/, '');
  if (extra) {
    for (const [key, value] of new URLSearchParams(extra)) {
      if (key) url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

/** Deeplink aus der Env-Konfiguration (Script + API-Route nutzen dasselbe). */
export function deeplinkFromEnv(
  product: Pick<ViatorProduct, 'productCode' | 'productUrl'>,
  env: Record<string, string | undefined> = process.env,
): string {
  return buildViatorDeeplink({
    productCode: product.productCode,
    productUrl: product.productUrl,
    partnerId: env.VIATOR_PARTNER_ID ?? null,
    template: env.VIATOR_DEEPLINK_TEMPLATE ?? null,
    pidParam: env.VIATOR_PID_PARAM ?? null,
    extraParams: env.VIATOR_DEEPLINK_PARAMS ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Mapping API -> DB-Contract                                          */
/* ------------------------------------------------------------------ */

/**
 * Viator-Produkt -> affiliate_product-jsonb (Task-1-Contract).
 * `matchedAt` bleibt beim Refresh erhalten (Erst-Match-Zeitpunkt).
 */
export function toAffiliateProduct(
  product: ViatorProduct,
  opts: { url: string; matchedAt: string; refreshedAt: string },
): AffiliateProduct {
  return {
    product_code: product.productCode,
    title: product.title ?? product.productCode,
    teaser: product.teaser,
    image_url: product.imageUrl,
    price_from: product.priceFrom,
    currency: product.currency,
    rating: product.rating,
    review_count: product.reviewCount,
    url: opts.url,
    matched_at: opts.matchedAt,
    refreshed_at: opts.refreshedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Response-Parsing (defensiv — Feldnamen variieren je Endpoint)       */
/* ------------------------------------------------------------------ */

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function pickImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    if (img == null || typeof img !== 'object') continue;
    const variants = (img as { variants?: unknown }).variants;
    if (Array.isArray(variants)) {
      // Groesste Variante gewinnt (Detailseiten-Bild).
      let best: { url: string; width: number } | null = null;
      for (const variant of variants) {
        if (variant == null || typeof variant !== 'object') continue;
        const url = firstString((variant as { url?: unknown }).url);
        const width = firstNumber((variant as { width?: unknown }).width) ?? 0;
        if (url && (!best || width > best.width)) best = { url, width };
      }
      if (best) return best.url;
    }
    const direct = firstString((img as { url?: unknown }).url);
    if (direct) return direct;
  }
  return null;
}

/** Roh-Produkt (search- ODER detail-Shape) -> ViatorProduct. */
export function parseViatorProduct(raw: unknown): ViatorProduct | null {
  if (raw == null || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;

  const productCode = firstString(rec.productCode, rec.code);
  if (!productCode) return null;

  const pricing = (rec.pricing ?? {}) as Record<string, unknown>;
  const summary = (pricing.summary ?? {}) as Record<string, unknown>;
  const reviews = (rec.reviews ?? {}) as Record<string, unknown>;

  return {
    productCode,
    title: firstString(rec.title, rec.name),
    teaser: firstString(rec.description, rec.shortDescription),
    imageUrl: pickImageUrl(rec.images),
    priceFrom: firstNumber(summary.fromPrice, pricing.fromPrice, rec.fromPrice),
    currency: firstString(pricing.currency, rec.currency),
    rating: firstNumber(reviews.combinedAverageRating, rec.rating),
    reviewCount: firstNumber(reviews.totalReviews, rec.reviewCount),
    productUrl: firstString(rec.productUrl, rec.webURL, rec.url),
    locationText: firstString(
      rec.destinationName,
      (rec.destination as Record<string, unknown> | undefined)?.name,
      rec.primaryDestinationName,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface ViatorClientOptions {
  apiKey?: string | null;
  baseUrl?: string;
  /** Injizierbar fuer Tests. */
  fetchImpl?: typeof fetch;
  queue?: RateLimitQueue;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Immer-leerer Client (kein Key konfiguriert). Wirft nie. */
const DISABLED_CLIENT: ViatorClient = {
  enabled: false,
  async searchProducts() {
    return [];
  },
  async getProduct() {
    return null;
  },
  async getPriceFrom() {
    return null;
  },
};

export function createViatorClient(options: ViatorClientOptions = {}): ViatorClient {
  const apiKey = (options.apiKey ?? process.env.VIATOR_API_KEY ?? '').trim();
  if (!apiKey) {
    // Kein Throw: Jobs und Routen laufen ohne Key einfach ergebnislos weiter.
    return DISABLED_CLIENT;
  }

  const baseUrl = (options.baseUrl ?? VIATOR_API_BASE).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const queue =
    options.queue ??
    new RateLimitQueue({ limit: VIATOR_RATE_LIMIT, windowMs: VIATOR_RATE_WINDOW_MS });

  async function request(path: string, init: RequestInit): Promise<unknown | null> {
    let throttleBudget = 5;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await queue.run(() =>
          fetchImpl(`${baseUrl}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
              'exp-api-key': apiKey,
              Accept: ACCEPT_HEADER,
              'Accept-Language': 'de-DE',
              'Content-Type': 'application/json',
              ...(init.headers as Record<string, string> | undefined),
            },
          }),
        );

        if (response.status === 429) {
          // Throttling verbraucht KEIN regulaeres Retry-Budget (Muster
          // deskline-client.ts) — der Server bittet explizit um Geduld.
          if (throttleBudget-- <= 0) return null;
          const retryAfter = Number(response.headers.get('Retry-After') ?? '1');
          const waitS = Number.isFinite(retryAfter)
            ? Math.min(Math.max(retryAfter, 0), MAX_RETRY_AFTER_SECONDS)
            : 1;
          await sleep(waitS * 1000);
          attempt--; // Throttle zaehlt nicht als Versuch
          continue;
        }

        if (response.status === 404) return null;

        if (!response.ok) {
          if (attempt >= MAX_RETRIES) {
            console.warn(`[viator] ${path} -> HTTP ${response.status}, aufgegeben`);
            return null;
          }
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }

        return (await response.json()) as unknown;
      } catch (error) {
        if (attempt >= MAX_RETRIES) {
          console.warn(`[viator] ${path} -> ${(error as Error).message}, aufgegeben`);
          return null;
        }
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  }

  return {
    enabled: true,

    async searchProducts({ searchTerm, limit = 5, currency = 'EUR' }: ViatorSearchOptions) {
      const term = searchTerm.trim();
      if (!term) return [];
      const body = {
        searchTerm: term,
        productFiltering: {},
        searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: Math.max(1, Math.min(limit, 20)) } }],
        currency,
      };
      const searchPath =
        (process.env.VIATOR_SEARCH_PATH ?? '').trim() || VIATOR_SEARCH_PATH_DEFAULT;
      const json = await request(searchPath, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (json == null || typeof json !== 'object') return [];
      const products = (json as { products?: { results?: unknown } }).products?.results;
      const list = Array.isArray(products)
        ? products
        : Array.isArray((json as { data?: unknown }).data)
          ? ((json as { data: unknown[] }).data)
          : [];
      return list
        .map(parseViatorProduct)
        .filter((p): p is ViatorProduct => p !== null);
    },

    async getProduct(productCode: string) {
      const code = productCode.trim();
      if (!code) return null;
      const json = await request(`/products/${encodeURIComponent(code)}`, { method: 'GET' });
      return parseViatorProduct(json);
    },

    async getPriceFrom(productCode: string) {
      const code = productCode.trim();
      if (!code) return null;
      const json = await request('/availability/schedules', {
        method: 'POST',
        body: JSON.stringify({ productCodes: [code] }),
      });
      if (json == null || typeof json !== 'object') return null;
      const entries = (json as { availabilitySchedules?: unknown }).availabilitySchedules;
      const first = Array.isArray(entries) ? entries[0] : null;
      if (first == null || typeof first !== 'object') return null;
      const summary = (first as { summary?: Record<string, unknown> }).summary ?? {};
      const price = firstNumber(summary.fromPrice, (first as Record<string, unknown>).fromPrice);
      if (price == null) return null;
      const currency = firstString((first as Record<string, unknown>).currency) ?? 'EUR';
      return { price, currency };
    },
  };
}
