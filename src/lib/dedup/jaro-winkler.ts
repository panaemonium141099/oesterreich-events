/**
 * Jaro-Winkler string similarity for fuzzy event deduplication.
 *
 * Pure TypeScript implementation — no external dependencies.
 * Used to detect near-duplicate events within (date, city) blocks.
 */

/**
 * Compute the Jaro similarity between two strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Maximum distance for matching characters
  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);

  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Compute the Jaro-Winkler similarity between two strings.
 *
 * Applies a prefix bonus (up to 4 characters) on top of Jaro similarity.
 * The scaling factor p is set to the standard 0.1.
 *
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function jaroWinkler(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);

  // Common prefix length (max 4 characters)
  const maxPrefixLen = Math.min(4, Math.min(s1.length, s2.length));
  let prefixLen = 0;
  for (let i = 0; i < maxPrefixLen; i++) {
    if (s1[i] === s2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }

  const p = 0.1; // standard Winkler scaling factor
  return jaro + prefixLen * p * (1 - jaro);
}
