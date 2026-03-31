/**
 * Geolocation utilities for requesting and caching user location.
 */

const LOCATION_KEY = 'user_location';
const LOCATION_ASKED_KEY = 'user_location_asked';

export async function requestGeolocation(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null), // user denied or error
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

export function getStoredLocation(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCATION_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function storeLocation(lat: number, lng: number) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng }));
}

export function hasAskedLocation(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(LOCATION_ASKED_KEY) === 'true';
}

export function markLocationAsked() {
  localStorage.setItem(LOCATION_ASKED_KEY, 'true');
}
