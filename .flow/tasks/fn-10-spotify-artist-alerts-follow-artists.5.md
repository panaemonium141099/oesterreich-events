# fn-10-spotify-artist-alerts-follow-artists.5 Artist Management UI: Follow, Search, Top Artists Pre-selection

## Description
Build the Artist Management page where users can view, search, follow, and unfollow artists. For Spotify-connected users, show all 50 imported artists from `imported_spotify_artists` with the top 10 pre-toggled as followed. All users can search for artists (Spotify search) or add manually by name.

**Size:** M
**Files:** `src/app/artists/page.tsx`, `src/components/Artists/ArtistCard.tsx`, `src/components/Artists/ArtistSearch.tsx`, `src/components/Artists/ImportedArtistsList.tsx`

## Approach

- New page at `/artists` (app route: `src/app/artists/page.tsx`)
- Sections:
  1. **Deine Spotify-Kuenstler**: If connected (via `/api/spotify/status`), show all 50 from `imported_spotify_artists` ordered by rank. Cross-reference with `followed_artists` to show which are toggled on. If not connected, show "Spotify verbinden" CTA
  2. **Kuenstler suchen**: Search input with debounced Spotify API calls via `/api/artists/search`, result cards with Follow/Unfollow button
  3. **Manuell hinzufuegen**: Free-text input + Add button for adding artists by name without Spotify
- Below sections: **Deine gefolgten Kuenstler**: List of all followed artists with unfollow buttons
- Toggle on = POST `/api/artists/follow`, toggle off = DELETE `/api/artists/follow`
- Follow dark theme, German-language UI

## Key context

- Check Spotify connectivity via `GET /api/spotify/status` (NOT profile.spotify_connected which is deprecated)
- `imported_spotify_artists` is the staging table -- read from it to show the 50 imported artists
- `followed_artists` is the canonical follow table -- toggle actions mutate this table
- SocialNav at `src/components/Social/SocialNav.tsx` provides bottom navigation -- add Artists link

## Acceptance
- [ ] `/artists` page renders with three sections: Spotify Artists, Search, Manual Add
- [ ] Spotify-connected users see all 50 imported artists ordered by rank, top 10 pre-toggled
- [ ] Non-connected users see Spotify connect CTA instead of imported artists
- [ ] Search input queries `/api/artists/search` with 300ms debounce
- [ ] Search results show artist card with name, image, Follow/Unfollow button
- [ ] Manual add input allows free-text artist name entry
- [ ] Followed artists list shows all follows with unfollow action
- [ ] Follow/unfollow calls update `followed_artists` via API routes (hard delete on unfollow)
- [ ] Spotify connectivity checked via `/api/spotify/status` (not profile columns)
- [ ] UI follows existing dark theme and component patterns
- [ ] German-language labels throughout
- [ ] Link to artist management from profile page and SocialNav

## Done summary
Built the Artist Management UI at /artists with four sections: Spotify imported artists (top 50 ordered by rank with top 10 pre-toggled), debounced Spotify search, manual free-text add, and a followed artists list with unfollow support. Added navigation links in SocialNav and profile page.
## Evidence
- Commits: 7a0e3f823f4e62c003dca87d4d5f06ebb8fb726b
- Tests: npm test (484 passed), npx tsc --noEmit (0 new errors)
- PRs: