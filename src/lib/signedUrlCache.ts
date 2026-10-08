import { supabase } from './supabase';

interface CacheEntry {
  url: string;
  expiresAt: number; // Unix timestamp in ms
}

const cache = new Map<string, CacheEntry>();
const inFlightPromises = new Map<string, Promise<string | null>>();

const EXPIRES_IN_SECONDS = 3600; // 1 hour
const SAFETY_MARGIN_MS = 60 * 1000; // 60 seconds

/**
 * Gets a valid signed URL for a file in the private 'note-files' bucket.
 * Caches URLs in memory until 60 seconds before expiration.
 */
export async function getSignedImageUrl(path: string): Promise<string | null> {
  if (!path) return null;

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - now > SAFETY_MARGIN_MS) {
    return cached.url;
  }

  // Deduplicate concurrent requests for the same path
  if (inFlightPromises.has(path)) {
    return inFlightPromises.get(path)!;
  }

  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from('note-files')
        .createSignedUrl(path, EXPIRES_IN_SECONDS);

      if (error || !data?.signedUrl) {
        console.error('Failed to create signed URL for path:', path, error);
        return null;
      }

      cache.set(path, {
        url: data.signedUrl,
        expiresAt: now + EXPIRES_IN_SECONDS * 1000,
      });

      return data.signedUrl;
    } catch (err) {
      console.error('Unexpected error fetching signed URL for:', path, err);
      return null;
    } finally {
      inFlightPromises.delete(path);
    }
  })();

  inFlightPromises.set(path, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate a cached signed URL for a given path.
 */
export function invalidateSignedImageUrl(path: string): void {
  cache.delete(path);
  inFlightPromises.delete(path);
}
