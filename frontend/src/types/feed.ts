/**
 * RSS/Atom feed subscription; contains articles and belongs to a folder.
 */
export interface Feed {
  /** Unique feed ID from API */
  id: number;

  /** Feed title (may be user-renamed) */
  title: string;

  /** Original feed URL */
  url: string;

  /** URL to feed's website (not the feed itself) */
  link: string;

  /** Favicon URL or null */
  faviconLink: string | null;

  /** Unix timestamp (seconds) of when the feed was added */
  added: number;

  /** Unix timestamp (seconds) of the latest known article for this feed */
  lastArticleDate: number | null;

  /** Unix timestamp (seconds) for the next scheduled refresh */
  nextUpdateTime: number | null;

  /** Parent folder ID, null for root-level feeds */
  folderId: number | null;

  /** Number of unread articles (computed client-side) */
  unreadCount: number;

  /** Sort order within folder (lower = higher) */
  ordering: number;

  /** Whether feed is pinned to top of sidebar */
  pinned: boolean;

  /** Feed fetch error message, null if healthy */
  lastUpdateError: string | null;

  /** Update mode: 0 = ignore, 1 = normal */
  updateMode: 0 | 1;

  /** Unix timestamp (seconds) of the latest feed-quality evaluation */
  lastQualityCheck: number | null;

  /** Whether extracted full text is currently enabled for this feed */
  useExtractedFulltext: boolean;

  /** Whether LLM summaries are currently enabled for this feed */
  useLlmSummary: boolean;

  /** Manual override for extracted full text, null when automatic */
  manualUseExtractedFulltext: boolean | null;

  /** Manual override for LLM summary, null when automatic */
  manualUseLlmSummary: boolean | null;

  /** Unix timestamp (seconds) of the latest manual feed-quality change */
  lastManualQualityOverride: number | null;
}

/** Raw feed object returned by the Nextcloud News API */
export interface ApiFeed {
  id: number;
  url: string;
  title: string | null;
  faviconLink: string | null;
  added: number;
  lastArticleDate: number | null;
  nextUpdateTime: number | null;
  folderId: number | null;
  ordering: number;
  link: string | null;
  pinned: boolean;
  updateErrorCount: number;
  lastUpdateError: string | null;
  lastQualityCheck: number | null;
  useExtractedFulltext: boolean;
  useLlmSummary: boolean;
  manualUseExtractedFulltext: boolean | null;
  manualUseLlmSummary: boolean | null;
  lastManualQualityOverride: number | null;
}

/** Response wrapper for GET /feeds */
export interface FeedsResponse {
  feeds: ApiFeed[];
  starredCount?: number;
  newestItemId?: number;
}

/** Transforms API feed into internal Feed with defaults */
export function normalizeFeed(api: ApiFeed): Feed {
  return {
    id: api.id,
    title: api.title ?? api.url,
    url: api.url,
    link: api.link ?? '',
    faviconLink: api.faviconLink,
    added: api.added,
    lastArticleDate: api.lastArticleDate,
    nextUpdateTime: api.nextUpdateTime,
    folderId: api.folderId,
    unreadCount: 0, // computed client-side
    ordering: api.ordering,
    pinned: api.pinned,
    lastUpdateError: api.lastUpdateError,
    updateMode: api.updateErrorCount > 0 ? 0 : 1,
    lastQualityCheck: api.lastQualityCheck,
    useExtractedFulltext: api.useExtractedFulltext,
    useLlmSummary: api.useLlmSummary,
    manualUseExtractedFulltext: api.manualUseExtractedFulltext,
    manualUseLlmSummary: api.manualUseLlmSummary,
    lastManualQualityOverride: api.lastManualQualityOverride,
  };
}
