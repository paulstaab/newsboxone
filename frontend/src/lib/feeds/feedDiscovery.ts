/**
 * Helpers for deciding when a submitted URL should use embedded feed discovery.
 */
const FEED_PATH_SEGMENT_PATTERN = /(^|\/)(feed|rss|atom)(\/)?$/i;
const FEED_EXTENSION_PATTERN = /\.(xml|rss|atom)$/i;

/**
 * Returns true for common direct RSS/Atom URL path hints.
 */
export function isLikelyDirectFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const normalizedPath = url.pathname.replace(/\/+$/, '');
    return (
      FEED_EXTENSION_PATTERN.test(normalizedPath) || FEED_PATH_SEGMENT_PATTERN.test(normalizedPath)
    );
  } catch {
    return false;
  }
}
