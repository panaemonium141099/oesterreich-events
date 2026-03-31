import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function defaultProps(props: IconProps, defaultSize = 20) {
  const { size = defaultSize, className = '', ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true as const,
    ...rest,
  };
}

// Calendar icon — replaces 📅
export function CalendarIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// Bell / Notification icon — replaces 🔔
export function BellIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// Heart icon — replaces ❤️
export function HeartIcon(props: IconProps & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return (
    <svg {...defaultProps(rest)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

// Broken heart icon — replaces 💔
export function HeartBrokenIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M12 5.67L10.94 4.61a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 00-7.78-7.78L12 5.67z" />
      <path d="M12 5.67l-1 3.33 2 2-1.5 3.5" />
    </svg>
  );
}

// User / Profile icon — replaces 👤
export function UserIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

// Users / Friends icon — replaces 👫 and 👥
export function UsersIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Chat bubble / Messages icon — replaces 💬
export function ChatBubbleIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

// Map pin icon — replaces 📍
export function MapPinIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Checkmark icon — replaces ✓
export function CheckIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Globe icon — replaces 🌍
export function GlobeIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

// Lock icon — replaces 🔒
export function LockIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

// Party / Celebration icon — replaces 🎉
export function PartyIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M5.8 11.3L2 22l10.7-3.8M5.8 11.3l4.9 4.9M5.8 11.3l1.8-3.2M16.5 2.3l-4.7 4.7M16.5 2.3l2 2M18.5 4.3l-4.7 4.7M12.5 14l-2.7-2.7M7.6 8.1l2.2 2.2" />
      <circle cx="19" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="21" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Newspaper / Feed icon — replaces 📰
export function NewspaperIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
      <path d="M5 10h6M5 14h6M5 18h3" />
    </svg>
  );
}

// Lightning bolt / Admin icon — replaces ⚡
export function BoltIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

// Door / Logout icon — replaces 🚪
export function LogoutIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

// Crown icon — replaces 👑
export function CrownIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M2 17l2-11 5 5 3-7 3 7 5-5 2 11H2z" />
      <path d="M2 17h20v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2z" />
    </svg>
  );
}

// Building / Business icon — replaces 🏢
export function BuildingIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
    </svg>
  );
}

// Groups / Collection icon (for groups nav)
export function GroupIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

// Download icon
export function DownloadIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

// Feed / RSS icon
export function FeedIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
      <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Send / Paper plane icon
export function SendIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

// Image / Photo icon
export function ImageIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

// Link / Attach icon
export function LinkIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

// Share icon
export function ShareIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

// Message / Comment icon
export function CommentIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

// Trending / Fire icon
export function TrendingIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

// Bookmark icon
export function BookmarkIcon(props: IconProps & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return (
    <svg {...defaultProps(rest)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

// Eye icon — for page views
export function EyeIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// Search icon — for search queries
export function SearchIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

// Chart bar icon — for analytics/trending
export function ChartBarIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

// Clock icon — for time/hours
export function ClockIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Sliders icon — for filters
export function SlidersIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

// External link icon — for link clicks
export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

// Funnel icon — for conversion funnel
export function FunnelIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

// Map icon — for regions/bundesland
export function MapIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

// Inbox icon — for empty state
export function InboxIcon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

// BarChart3 icon — for analytics dashboard
export function BarChart3Icon(props: IconProps) {
  return (
    <svg {...defaultProps(props)}>
      <path d="M3 3v18h18M7 16v-3m4 3v-7m4 7V8m4 8v-5" />
    </svg>
  );
}

// Colored dot — replaces 🟢 (use CSS background-color)
export function StatusDot({ color = 'bg-green-500', pulse = false, className = '' }: { color?: string; pulse?: boolean; className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      {pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}
