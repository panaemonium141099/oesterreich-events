export interface FeedActivity {
  id: string;
  user_id: string;
  type: string;
  event_id: string | null;
  group_id: string | null;
  target_user_id: string | null;
  memory_id: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profile: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
  event?: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location_name: string | null;
    image_url: string | null;
    category: string | null;
    save_count: number | null;
    // URL-builder fields — allow FeedItem share + any link rendering
    // through `buildEventUrlV2()` to land on the canonical URL without
    // a UUID-form 308 hop.
    slug?: string | null;
    postal_code?: string | null;
    address?: string | null;
    bundesland?: string | null;
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
  target_user?: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface TrendingEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
  save_count: number;
  // URL-builder fields — needed by `buildEventUrlV2()` so Story / Sidebar
  // navigation lands on the canonical `/events/{plz-ort}/{date}/{slug}`
  // form directly instead of taking a 308 hop through the legacy UUID
  // URL. Missing fields degrade gracefully (slug → shortId, plz → '0000',
  // ort → bundesland-capital or 'at').
  slug?: string | null;
  postal_code?: string | null;
  address?: string | null;
  bundesland?: string | null;
}

export function getActivityText(activity: FeedActivity): string {
  const name = `${activity.profile?.first_name || ''} ${activity.profile?.last_name || ''}`.trim() || 'Jemand';
  switch (activity.type) {
    case 'event_saved':
      return `${name} hat ein Event gespeichert`;
    case 'event_created':
      return `${name} hat ein Event erstellt`;
    case 'group_joined':
      return `${name} ist einer Gruppe beigetreten`;
    case 'friend_added': {
      const targetName = activity.target_user
        ? `${activity.target_user.first_name} ${activity.target_user.last_name}`.trim()
        : '';
      return targetName
        ? `${name} und ${targetName} sind jetzt Freunde`
        : `${name} hat einen neuen Freund`;
    }
    case 'event_attended':
      return `${name} nimmt an einem Event teil`;
    case 'event_shared':
      return `${name} hat ein Event geteilt`;
    case 'memory_created':
      return `${name} hat eine Erinnerung erstellt`;
    case 'post':
      return name;
    default:
      return `${name} war aktiv`;
  }
}

export function getActivityTypeLabel(type: string): string {
  switch (type) {
    case 'event_saved': return 'Gespeichert';
    case 'event_created': return 'Erstellt';
    case 'event_shared': return 'Geteilt';
    case 'event_attended': return 'Dabei';
    case 'post': return 'Post';
    case 'group_joined': return 'Beigetreten';
    case 'friend_added': return 'Freundschaft';
    case 'memory_created': return 'Erinnerung';
    default: return 'Aktivit\u00e4t';
  }
}

export function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'gerade eben';
  if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
  if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
  if (diff < 604800000) return `vor ${Math.floor(diff / 86400000)} Tagen`;
  return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Activity types that render as compact single-line notifications, not full posts */
export function isCompactActivity(type: string): boolean {
  return type === 'group_joined' || type === 'friend_added';
}

/** Get display name from profile, fallback to "Unbekannt" */
export function getUsername(profile: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!profile) return 'Unbekannt';
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unbekannt';
}

/** Get activity caption text without the username prefix (for Instagram-style inline display) */
export function getActivityCaption(activity: FeedActivity): string {
  switch (activity.type) {
    case 'event_saved': return 'hat ein Event gespeichert';
    case 'event_created': return 'hat ein Event erstellt';
    case 'event_shared': return 'hat ein Event geteilt';
    case 'event_attended': return 'nimmt an einem Event teil';
    case 'group_joined': return `ist "${activity.group?.name || 'einer Gruppe'}" beigetreten`;
    case 'friend_added': return `ist jetzt mit ${activity.target_user ? [activity.target_user.first_name, activity.target_user.last_name].filter(Boolean).join(' ') : 'jemandem'} befreundet`;
    case 'memory_created': return 'hat eine Erinnerung erstellt';
    case 'post': return activity.content || '';
    default: return '';
  }
}
