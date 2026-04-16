export {
  normalizeEventCategory,
  getCategoryMeta,
  getCategoryBadgeClass,
  ALL_CATEGORIES,
  CATEGORY_META_MAP,
  CATEGORY_ALIASES,
} from './categoryMeta';
export type { CanonicalCategory, CategoryMeta } from './categoryMeta';

export {
  resolvePrimaryEventImage,
  resolveCategoryFallbackImage,
  resolveGenericFallbackImage,
  isUsableImageCandidate,
} from './resolveEventImage';
