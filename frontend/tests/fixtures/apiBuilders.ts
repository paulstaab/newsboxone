import type { ApiArticle, ApiFeed } from '@/types';

const nowInSeconds = 1_700_220_000;

export function buildApiArticle(partial: Partial<ApiArticle> = {}): ApiArticle {
  const id = partial.id ?? 100;
  return {
    id,
    guid: partial.guid ?? `guid-${String(id)}`,
    guidHash: partial.guidHash ?? `hash-${String(id)}`,
    title: partial.title ?? 'Article title',
    author: partial.author ?? 'Reporter',
    url: partial.url ?? `https://example.com/articles/${String(id)}`,
    body: partial.body ?? '<p>Body</p>',
    feedId: partial.feedId ?? 10,
    folderId: partial.folderId ?? null,
    unread: partial.unread ?? true,
    starred: partial.starred ?? false,
    pubDate: partial.pubDate ?? nowInSeconds,
    lastModified: partial.lastModified ?? nowInSeconds,
    enclosureLink: partial.enclosureLink ?? null,
    enclosureMime: partial.enclosureMime ?? null,
    fingerprint: partial.fingerprint ?? `fp-${String(id)}`,
    contentHash: partial.contentHash ?? `ch-${String(id)}`,
    mediaThumbnail: partial.mediaThumbnail ?? null,
    mediaDescription: partial.mediaDescription ?? null,
    rtl: partial.rtl ?? false,
    updatedDate: partial.updatedDate ?? null,
  };
}

export function buildApiFeed(partial: Partial<ApiFeed> = {}): ApiFeed {
  const id = partial.id ?? 10;
  return {
    id,
    url: partial.url ?? `https://example.com/feeds/${String(id)}.xml`,
    type: partial.type ?? 'rss',
    title: partial.title ?? 'Example Feed',
    faviconLink: partial.faviconLink ?? null,
    added: partial.added ?? nowInSeconds,
    lastArticleDate: partial.lastArticleDate ?? nowInSeconds,
    nextUpdateTime: partial.nextUpdateTime ?? nowInSeconds + 3600,
    folderId: partial.folderId ?? null,
    ordering: partial.ordering ?? 0,
    link: partial.link ?? 'https://example.com',
    pinned: partial.pinned ?? false,
    updateErrorCount: partial.updateErrorCount ?? 0,
    lastUpdateError: partial.lastUpdateError ?? null,
    lastQualityCheck: partial.lastQualityCheck ?? null,
    useExtractedFulltext: partial.useExtractedFulltext ?? false,
    useLlmSummary: partial.useLlmSummary ?? false,
    manualUseExtractedFulltext: partial.manualUseExtractedFulltext ?? null,
    manualUseLlmSummary: partial.manualUseLlmSummary ?? null,
    lastManualQualityOverride: partial.lastManualQualityOverride ?? null,
  };
}
