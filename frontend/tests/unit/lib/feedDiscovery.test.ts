import { describe, expect, it } from 'vitest';
import { isLikelyDirectFeedUrl } from '@/lib/feeds/feedDiscovery';

describe('feed discovery helpers', () => {
  it.each([
    'https://example.com/feed',
    'https://example.com/feed/',
    'https://example.com/rss',
    'https://example.com/atom',
    'https://example.com/news.xml',
    'https://example.com/news.rss',
    'https://example.com/news.atom',
  ])('treats %s as a direct feed URL', (url) => {
    expect(isLikelyDirectFeedUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com',
    'https://example.com/news',
    'https://example.com/rss-reader',
    'not a url',
  ])('does not treat %s as a direct feed URL', (url) => {
    expect(isLikelyDirectFeedUrl(url)).toBe(false);
  });
});
