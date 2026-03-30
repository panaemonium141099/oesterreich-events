/**
 * Category-based fallback images for events without image_url.
 * Uses Unsplash images (free, no attribution required for hotlinking).
 */

const CATEGORY_IMAGES: Record<string, string> = {
  'Musik': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop',
  'Sport': 'https://images.unsplash.com/photo-1461896836934-bd45ba6343c1?w=400&h=300&fit=crop',
  'Kultur': 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&h=300&fit=crop',
  'Familie': 'https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?w=400&h=300&fit=crop',
  'Märkte': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400&h=300&fit=crop',
  'Wein & Kulinarik': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop',
  'Natur': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
  'Rave': 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=300&fit=crop',
  'Sonstiges': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop';

export function getCategoryFallbackImage(category: string | undefined | null): string {
  if (!category) return DEFAULT_IMAGE;
  return CATEGORY_IMAGES[category] || DEFAULT_IMAGE;
}

export function getEventImage(imageUrl: string | undefined | null, category: string | undefined | null): string {
  if (imageUrl && imageUrl.trim()) return imageUrl;
  return getCategoryFallbackImage(category);
}
