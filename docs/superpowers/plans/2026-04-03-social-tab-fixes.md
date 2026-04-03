# Social Tab Fixes — Implementation Plan

## Context
7 issues on social/feed/profile pages. All use Supabase client-side, dark glassmorphism design with `bg-white/[0.03]` cards, `border-white/[0.06]` borders, `text-white/40` muted text.

## Tasks

### Task 1: Feed Design — Lighter Background + Remove Blitz-Emoji
**Files:** `src/app/feed/page.tsx`, `src/components/Feed/FeedItem.tsx`, `src/components/Feed/FeedActivityIcon.tsx`
- Change feed page background from true-black `gradient-mesh` to dark-grey tone (`bg-[#141416]` or `bg-zinc-900`)
- Same for all social pages: profile, friends, messages, groups, saved, memories
- FeedItem cards: lift from `bg-white/[0.03]` to `bg-white/[0.05]` for contrast against new bg
- Remove any flash/blitz emoji from FeedActivityIcon, replace with clean SVG icon
- Keep glassmorphism aesthetic, just lighter base

### Task 2: Notifications — Bell Icon + /notifications Page + Toasts
**New files:** `src/components/Notifications/NotificationBell.tsx`, `src/components/Notifications/NotificationToast.tsx`, `src/app/notifications/page.tsx`
**Modified:** `src/components/Layout/SocialNav.tsx`, `src/components/Layout/Header.tsx`

**NotificationBell component:**
- Bell SVG icon with badge count (same red badge style as chat unread)
- Fetches `notifications` table count where `user_id = current && read = false`
- Supabase realtime subscription on `notifications` table for live updates
- Placed in Header (next to profile avatar) AND in SocialNav (as additional icon or merged)

**NotificationToast component:**
- Fixed bottom-right, slides in/out with framer-motion
- Shows from_user avatar + title + brief body
- Auto-dismiss 5s, click navigates to action_url
- Triggered by Supabase realtime INSERT on notifications

**/notifications page:**
- Full list grouped by date (Heute, Gestern, Aeltere)
- Each item: from_user avatar, title, body, relative time, read/unread indicator
- "Alle als gelesen markieren" button
- Mark individual as read on click
- Same dark-grey background as feed

### Task 3: Likes — Persist to DB + Trigger Notification
**Modified:** `src/components/Feed/FeedItem.tsx`, `src/components/Feed/feed-types.ts`
**New table needed:** `activity_likes` (or use existing pattern)

- Create `activity_likes` table via Supabase: `id, user_id, activity_id, created_at` (unique on user_id+activity_id)
- FeedItem: on like, INSERT into `activity_likes` + INSERT into `notifications` (type: 'like', from_user_id: current, user_id: activity.user_id)
- On unlike, DELETE from `activity_likes` + optionally delete notification
- Show like count next to heart icon
- Load initial liked state from DB

### Task 4: Comments — Post Detail Page
**New files:** `src/app/feed/[activityId]/page.tsx`, `src/components/Feed/CommentItem.tsx`
**New table:** `activity_comments` (`id, activity_id, user_id, content, created_at`)

- FeedItem comment button navigates to `/feed/[activityId]`
- Detail page: shows the full post + all comments below
- Comment input at bottom (sticky), submit inserts into `activity_comments` + notification to post owner
- CommentItem: avatar, name, time, content
- Show comment count on FeedItem
- Same dark-grey styling

### Task 5: Share Sheet — Universal Share Component
**New file:** `src/components/Share/ShareSheet.tsx`
**Modified:** `src/components/Feed/FeedItem.tsx`, event detail pages

- Bottom sheet (framer-motion slide up) with share options:
  - Copy Link (navigator.clipboard)
  - WhatsApp (wa.me/?text=URL)
  - Facebook (facebook.com/sharer)
  - Email (mailto:?subject=&body=)
  - Chat — opens friend picker: search friends, select, sends DM with event_share type
- Works for: Events (URL: /events/[id]), Posts (URL: /feed/[activityId]), Profiles (URL: /profile/[userId])
- Increments share_count on events table when sharing events
- Triggers notification when shared via Chat

### Task 6: BottomBar — 5+2 with More Menu
**Modified:** `src/components/Layout/SocialNav.tsx`

- Keep 4 main tabs: Map, Feed, Chat, Profile
- Replace Calendar with "More" (three dots icon)
- More menu (bottom sheet slide-up): Calendar, Blog (/blog), Home (/), Saved, Friends, Groups
- More menu uses same glassmorphism style
- Active state: if current page is in More menu, More icon gets active state
- Smooth framer-motion animation for More sheet

### Task 7: Unified Profile Symbol — Same Dropdown Everywhere
**New file:** `src/components/Layout/ProfileDropdown.tsx`
**Modified:** All social pages, `SocialNav.tsx`

- Extract Header.tsx user menu into standalone `ProfileDropdown` component
- Same avatar circle + chevron + dropdown with all links (Profil, Gespeicherte Events, Freunde, Nachrichten, Gruppen, Feed, Admin, Abmelden)
- Place in top-right of ALL social pages (feed, profile, friends, messages, groups, saved, memories, notifications)
- On social pages: replaces current SocialNav profile tab behavior
- Adapts to dark background (always dark mode variant)

### Task 8: Profile Edit Mode
**Modified:** `src/app/profile/page.tsx`

- Default state: all fields readonly (displayed as text, not inputs)
- "Bearbeiten" button top-right, toggles `isEditing` state
- When editing: fields become inputs (current styling)
- Save button only visible in edit mode
- Cancel button to discard changes
- Avatar: always has a small camera/edit overlay icon, clicking opens file picker (independent of edit mode)
- Smooth transition between view/edit modes

### Task 9: Logout State Reset
**Modified:** `src/lib/supabase/auth-context.tsx`, potentially router

- signOut: after `supabase.auth.signOut()`, clear ALL local state:
  - setProfile(null) (already done)
  - setUser(null)
  - setSession(null)
  - Clear any cached data (localStorage keys with 'supabase' prefix are handled by supabase-js)
- After signOut, redirect to '/' (landing page)
- Social pages already redirect to /auth/login if !user, so this should cascade

## Execution Order
Independent tasks (can run in parallel):
- Wave 1: Task 1 (Feed Design), Task 6 (BottomBar), Task 8 (Profile Edit), Task 9 (Logout)
- Wave 2: Task 3 (Likes DB), Task 7 (ProfileDropdown)
- Wave 3: Task 2 (Notifications), Task 4 (Comments), Task 5 (Share Sheet)

## Verification
- `npm run build` must pass after each wave
- Manual visual check of feed, profile, bottombar
- Test like/unlike cycle, comment creation, share sheet opening
- Test logout -> verify clean state -> login again
