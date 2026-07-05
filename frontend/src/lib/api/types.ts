import type { Article, Feed, Folder, ItemsQueryParams, ItemFilterType } from '@/types';
import type { ApiRequestOptions } from './client';

export interface DiscoveredFeed {
  title: string | null;
  url: string;
}

/**
 * Version response from the public API.
 */
export interface VersionResponse {
  version: string;
  apiLevels: string[];
}

/**
 * Feed endpoint operations.
 */
export interface FeedsApi {
  getAll(): Promise<{
    feeds: Feed[];
    starredCount: number;
    newestItemId: number | null;
  }>;
  create(
    url: string,
    folderId?: number | null,
  ): Promise<{ feed: Feed; newestItemId: number | null }>;
  discover(url: string): Promise<DiscoveredFeed[]>;
  delete(feedId: number): Promise<void>;
  move(feedId: number, folderId: number | null): Promise<void>;
  rename(feedId: number, feedTitle: string): Promise<void>;
  markRead(feedId: number, newestItemId: number): Promise<void>;
  updateQuality(
    feedId: number,
    input: {
      useExtractedFulltext?: boolean | null;
      useLlmSummary?: boolean | null;
      reevaluate?: boolean;
    },
  ): Promise<Feed>;
}

/**
 * Folder endpoint operations.
 */
export interface FoldersApi {
  getAll(): Promise<Folder[]>;
  create(name: string): Promise<Folder>;
  rename(folderId: number, name: string): Promise<void>;
  delete(folderId: number): Promise<void>;
  markRead(folderId: number, newestItemId: number): Promise<void>;
}

/**
 * Item endpoint operations.
 */
export interface ItemsApi {
  get(params?: ItemsQueryParams, options?: ApiRequestOptions): Promise<Article[]>;
  getById(id: number): Promise<Article | null>;
  getContent(id: number): Promise<string | null>;
  getUpdated(lastModified: number, type?: ItemFilterType, id?: number): Promise<Article[]>;
  markRead(itemId: number): Promise<void>;
  markUnread(itemId: number): Promise<void>;
  star(itemId: number): Promise<void>;
  unstar(itemId: number): Promise<void>;
  markMultipleRead(itemIds: number[]): Promise<void>;
  markMultipleUnread(itemIds: number[]): Promise<void>;
  starMultiple(itemIds: number[]): Promise<void>;
  unstarMultiple(itemIds: number[]): Promise<void>;
  markAllRead(newestItemId: number): Promise<void>;
}

/**
 * Version endpoint operations.
 */
export interface VersionApi {
  get(): Promise<VersionResponse>;
}

/**
 * Authentication operations.
 */
export interface AuthApi {
  validateCredentials(
    username: string,
    password: string,
    rememberDevice: boolean,
  ): Promise<{
    valid: boolean;
    error?: string;
    token?: { token: string; expiresAt: string | number };
  }>;
  issueToken(
    username: string,
    password: string,
    rememberDevice: boolean,
  ): Promise<{ token: string; expiresAt: string | number }>;
  logout(): Promise<void>;
}

/**
 * Composed API client grouped by endpoint family.
 */
export interface ApiClient {
  feeds: FeedsApi;
  folders: FoldersApi;
  items: ItemsApi;
  version: VersionApi;
  auth: AuthApi;
}
