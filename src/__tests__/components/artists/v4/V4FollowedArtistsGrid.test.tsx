import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FollowedArtistsGrid } from '@/components/Artists/v4/V4FollowedArtistsGrid';

describe('V4FollowedArtistsGrid', () => {
  const artists = [
    { id: '1', artist_name: 'Bilderbuch', artist_name_normalized: 'bilderbuch', spotify_image_url: null, upcoming_matches: 2 },
    { id: '2', artist_name: 'Wanda',      artist_name_normalized: 'wanda',      spotify_image_url: null, upcoming_matches: 0 },
  ];

  it('renders each artist card', () => {
    render(<V4FollowedArtistsGrid artists={artists}/>);
    expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    expect(screen.getByText('Wanda')).toBeInTheDocument();
  });

  it('shows upcoming match count', () => {
    render(<V4FollowedArtistsGrid artists={artists}/>);
    expect(screen.getByText(/2 kommende auftritte/i)).toBeInTheDocument();
  });

  it('shows "wir bleiben dran" fallback when 0 matches', () => {
    render(<V4FollowedArtistsGrid artists={artists}/>);
    expect(screen.getByText(/wir bleiben dran/i)).toBeInTheDocument();
  });

  it('empty-state when artists list is empty', () => {
    render(<V4FollowedArtistsGrid artists={[]}/>);
    expect(screen.getByText(/such einen künstler oben/i)).toBeInTheDocument();
  });
});
