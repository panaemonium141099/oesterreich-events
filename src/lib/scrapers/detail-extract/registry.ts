// src/lib/scrapers/detail-extract/registry.ts
// Source-name → Adapter lookup. See spec §3.

import type { Adapter } from './types';

const ADAPTERS: Adapter[] = [];
const BY_NAME = new Map<string, Adapter>();

export function getAdapter(sourceName: string): Adapter | null {
  return BY_NAME.get(sourceName) ?? null;
}

/** Register an adapter for one or more source names. Idempotent. */
export function registerAdapter(a: Adapter): void {
  if (!ADAPTERS.includes(a)) ADAPTERS.push(a);
  for (const n of a.sourceNames) BY_NAME.set(n, a);
}

/** Test helper: forget all registrations. */
export function _resetAdaptersForTests(): void {
  ADAPTERS.length = 0;
  BY_NAME.clear();
}
