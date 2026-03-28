/**
 * Individual news item from a feed; primary content displayed in timeline.
 */
export interface Article {
  /** Unique item ID from API */
  id: number;

  /** GUID from feed (used for starring) */
  guid: string;

  /** Hash of GUID (used in star/unstar API calls) */
  guidHash: string;

  /** Article headline */
  title: string;

  /** Article author name, may be empty */
  author: string;

  /** URL to original article */
  url: string;

  /** HTML content body */
  body: string;

  /** Parent feed ID */
  feedId: number;

  /** Parent folder ID derived from feed (null if uncategorized) */
  folderId: number | null;

  /** Whether article has been read */
  unread: boolean;

  /** Whether article is starred */
  starred: boolean;

  /** Unix timestamp (seconds) of publication */
  pubDate: number;

  /** Unix timestamp (seconds) of last modification */
  lastModified: number;

  /** Enclosure URL (podcast/video), null if none */
  enclosureLink: string | null;

  /** Enclosure MIME type */
  enclosureMime: string | null;

  /** Fingerprint for deduplication */
  fingerprint: string;

  /** Content hash for change detection */
  contentHash: string;

  /** Rich media preview metadata (optional) */
  mediaThumbnail: string | null;
  mediaDescription: string | null;

  /** Right-to-left text direction */
  rtl: boolean;
}

/** Lightweight article representation stored in the timeline cache */
export interface ArticlePreview {
  /** Unique item ID */
  id: number;

  /** Parent folder ID (UNCATEGORIZED_FOLDER_ID for root-level items) */
  folderId: number;

  /** Parent feed ID */
  feedId: number;

  /** Display title (fallback applied) */
  title: string;

  /** Feed display name */
  feedName: string;

  /** Article author name, may be empty */
  author: string;

  /** Plain-text summary used in cards */
  summary: string;

  /** HTML body used for the pop-out view */
  body: string;

  /** Original article URL */
  url: string;

  /** Thumbnail URL (if available) */
  thumbnailUrl: string | null;

  /** Unix timestamp (seconds) of publication */
  pubDate: number;

  /** Whether the article is unread */
  unread: boolean;

  /** Whether the article is starred */
  starred: boolean;

  /** Whether the article has full-text content stored */
  hasFullText: boolean;

  /** Timestamp (ms) when the article was cached */
  storedAt?: number;
}

/** Raw article object returned by the Nextcloud News API */
export interface ApiArticle {
  id: number;
  guid: string;
  guidHash: string;
  title: string | null;
  author: string | null;
  url: string | null;
  body: string | null;
  feedId: number;
  folderId?: number | null;
  unread: boolean;
  starred: boolean;
  pubDate: number | null;
  lastModified: number;
  enclosureLink: string | null;
  enclosureMime: string | null;
  fingerprint: string | null;
  contentHash: string | null;
  mediaThumbnail: string | null;
  mediaDescription: string | null;
  rtl: boolean;
  updatedDate: number | null;
}

/** Response wrapper for GET /items */
export interface ItemsResponse {
  items: ApiArticle[];
}

/** Item filter type enum matching API values */
export enum ItemFilterType {
  FEED = 0,
  FOLDER = 1,
  STARRED = 2,
  ALL = 3,
}

/** Query parameters for GET /items */
export interface ItemsQueryParams {
  batchSize?: number;
  offset?: number;
  type?: ItemFilterType;
  id?: number;
  getRead?: boolean;
  oldestFirst?: boolean;
  lastModified?: number;
}

/** Transforms API article into internal Article with defaults */
export function normalizeArticle(api: ApiArticle): Article {
  return {
    id: api.id,
    guid: api.guid,
    guidHash: api.guidHash,
    title: api.title ?? '(No title)',
    author: api.author ?? '',
    url: api.url ?? '',
    body: api.body ?? '',
    feedId: api.feedId,
    folderId: api.folderId ?? null,
    unread: api.unread,
    starred: api.starred,
    pubDate: api.pubDate ?? 0,
    lastModified: api.lastModified,
    enclosureLink: api.enclosureLink,
    enclosureMime: api.enclosureMime,
    fingerprint: api.fingerprint ?? '',
    contentHash: api.contentHash ?? '',
    mediaThumbnail: api.mediaThumbnail,
    mediaDescription: api.mediaDescription,
    rtl: api.rtl,
  };
}
