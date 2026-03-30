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
