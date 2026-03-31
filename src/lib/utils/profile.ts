/**
 * Profile utility functions - single source of truth for profile completeness checks.
 */

interface ProfileFields {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
}

/**
 * A profile is complete when the required fields (first name, last name, birth date) are filled.
 * Used in both client-side auth context and server-side auth callback.
 */
export function isProfileComplete(profile: ProfileFields | null): boolean {
  if (!profile) return false;
  return !!(
    profile.first_name?.trim() &&
    profile.last_name?.trim() &&
    profile.birth_date
  );
}
