import type { ArticlePreview } from './article';

/**
 * Organizational container for feeds; mirrors Nextcloud News folder entity.
 */
export interface Folder {
  /** Unique folder ID from API */
  id: number;

  /** Display name */
  name: string;

  /** Computed: total unread count across contained feeds */
  unreadCount: number;

  /** Computed: array of feed IDs in this folder */
  feedIds: number[];
}

/** Raw folder object returned by the Nextcloud News API */
export interface ApiFolder {
  id: number;
  name: string;
  feeds?: number[];
  parentId?: number | null;
  opened?: boolean;
}

/** Response wrapper for GET /folders */
export interface FoldersResponse {
  folders: ApiFolder[];
}

/** Transforms API folder into internal Folder with defaults */
export function normalizeFolder(api: ApiFolder): Folder {
  return {
    id: api.id,
    name: api.name,
    unreadCount: 0, // computed client-side
    feedIds: api.feeds ?? [],
  };
}

/** Virtual folder ID for uncategorized feeds (root-level) */
export const UNCATEGORIZED_FOLDER_ID = -1;

export type FolderQueueStatus = 'queued' | 'active' | 'skipped' | 'completed';

export interface FolderQueueEntry {
  id: number;
  name: string;
  sortOrder: number;
  status: FolderQueueStatus;
  unreadCount: number;
  articles: ArticlePreview[];
  lastUpdated: number;
}

export interface FolderQueuePill {
  id: number;
  label: string;
  unreadCount: number;
  isActive: boolean;
  isSkipped: boolean;
}

export interface TimelineCacheEnvelope {
  version: number;
  lastSynced: number;
  activeFolderId: number | null;
  folders: Record<number, FolderQueueEntry>;
  pendingReadIds: number[];
  pendingSkipFolderIds: number[];
}

export interface FolderProgressState {
  currentFolderId: number | null;
  nextFolderId: number | null;
  remainingFolderIds: number[];
  allViewed: boolean;
}

export interface MarkActionPayload {
  itemIds: number[];
  folderId: number;
  source: 'mark-all' | 'expand';
}
