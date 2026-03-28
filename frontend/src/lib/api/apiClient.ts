/**
 * Centralized API client with endpoint groups for cleaner architecture and better testability.
 * Provides api.feeds.getAll(), api.items.markRead(), etc. interface.
 */

import {
  ApiError,
  NetworkError,
  apiGet as baseApiGet,
  apiPost as baseApiPost,
  apiPut as baseApiPut,
  apiDelete as baseApiDelete,
  issueToken as baseIssueToken,
  revokeCurrentToken as baseRevokeCurrentToken,
  validateCredentials as baseValidateCredentials,
  type ApiRequestOptions,
} from './client';
import {
  type Feed,
  type ApiFeed,
  type FeedsResponse,
  normalizeFeed,
  type Folder,
  type FoldersResponse,
  normalizeFolder,
  type Article,
  type ItemsResponse,
  type ItemsQueryParams,
  ItemFilterType,
  normalizeArticle,
} from '@/types';
import { CONFIG } from '@/lib/config/env';

/**
 * Version response from Nextcloud News API.
 */
export interface VersionResponse {
  version: string;
  apiLevels: string[];
}

/**
 * Feeds endpoint group.
 */
export interface FeedsApi {
  /**
   * Fetches all subscribed feeds.
   */
  getAll(): Promise<{
    feeds: Feed[];
    starredCount: number;
    newestItemId: number | null;
  }>;

  /**
   * Adds a new feed subscription.
   */
  create(
    url: string,
    folderId?: number | null,
  ): Promise<{ feed: Feed; newestItemId: number | null }>;

  /**
   * Deletes a feed subscription.
   */
  delete(feedId: number): Promise<void>;

  /**
   * Moves a feed to a different folder.
   */
  move(feedId: number, folderId: number | null): Promise<void>;

  /**
   * Renames a feed.
   */
  rename(feedId: number, feedTitle: string): Promise<void>;

  /**
   * Marks all items in a feed as read up to a specific item ID.
   */
  markRead(feedId: number, newestItemId: number): Promise<void>;
}

/**
 * Folders endpoint group.
 */
export interface FoldersApi {
  /**
   * Fetches all folders.
   */
  getAll(): Promise<Folder[]>;

  /**
   * Creates a new folder.
   */
  create(name: string): Promise<Folder>;

  /**
   * Renames an existing folder.
   */
  rename(folderId: number, name: string): Promise<void>;

  /**
   * Deletes a folder.
   */
  delete(folderId: number): Promise<void>;

  /**
   * Marks all items in a folder as read.
   */
  markRead(folderId: number, newestItemId: number): Promise<void>;
}

/**
 * Items endpoint group (also referred to as articles).
 */
export interface ItemsApi {
  /**
   * Fetches items with optional filtering and pagination.
   */
  get(params?: ItemsQueryParams, options?: ApiRequestOptions): Promise<Article[]>;

  /**
   * Fetches a single article by ID.
   */
  getById(id: number): Promise<Article | null>;

  /**
   * Fetches the full content HTML for a single article.
   * Returns null when the endpoint is missing or the item has no content.
   */
  getContent(id: number): Promise<string | null>;

  /**
   * Fetches items modified since a specific timestamp.
   */
  getUpdated(lastModified: number, type?: ItemFilterType, id?: number): Promise<Article[]>;

  /**
   * Marks a single item as read.
   */
  markRead(itemId: number): Promise<void>;

  /**
   * Marks a single item as unread.
   */
  markUnread(itemId: number): Promise<void>;

  /**
   * Stars a single item.
   */
  star(itemId: number): Promise<void>;

  /**
   * Unstars a single item.
   */
  unstar(itemId: number): Promise<void>;

  /**
   * Marks multiple items as read.
   */
  markMultipleRead(itemIds: number[]): Promise<void>;

  /**
   * Marks multiple items as unread.
   */
  markMultipleUnread(itemIds: number[]): Promise<void>;

  /**
   * Stars multiple items.
   */
  starMultiple(itemIds: number[]): Promise<void>;

  /**
   * Unstars multiple items.
   */
  unstarMultiple(itemIds: number[]): Promise<void>;

  /**
   * Marks all items as read up to a specific item ID.
   */
  markAllRead(newestItemId: number): Promise<void>;
}

/**
 * Version endpoint group.
 */
export interface VersionApi {
  /**
   * Fetches API version information without authentication.
   */
  get(): Promise<VersionResponse>;
}

/**
 * Authentication utilities.
 */
export interface AuthApi {
  /**
   * Validates submitted credentials by attempting token issuance.
   */
  validateCredentials(
    username: string,
    password: string,
    rememberDevice: boolean,
  ): Promise<{
    valid: boolean;
    error?: string;
    token?: { token: string; expiresAt: string | number };
  }>;

  /**
   * Issues a browser auth token.
   */
  issueToken(
    username: string,
    password: string,
    rememberDevice: boolean,
  ): Promise<{ token: string; expiresAt: string | number }>;

  /**
   * Revokes the current browser token.
   */
  logout(): Promise<void>;
}

/**
 * Main API client interface with endpoint groups.
 */
export interface ApiClient {
  feeds: FeedsApi;
  folders: FoldersApi;
  items: ItemsApi;
  version: VersionApi;
  auth: AuthApi;
}

/**
 * Builds query string from ItemsQueryParams.
 */
function buildItemsQuery(params: ItemsQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.batchSize !== undefined) {
    searchParams.set('batchSize', String(params.batchSize));
  }
  if (params.offset !== undefined) {
    searchParams.set('offset', String(params.offset));
  }
  if (params.type !== undefined) {
    searchParams.set('type', String(params.type));
  }
  if (params.id !== undefined) {
    searchParams.set('id', String(params.id));
  }
  if (params.getRead !== undefined) {
    searchParams.set('getRead', String(params.getRead));
  }
  if (params.oldestFirst !== undefined) {
    searchParams.set('oldestFirst', String(params.oldestFirst));
  }
  if (params.lastModified !== undefined) {
    searchParams.set('lastModified', String(params.lastModified));
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Implementation of the centralized API client.
 */
class ApiClientImpl implements ApiClient {
  public readonly feeds: FeedsApi;
  public readonly folders: FoldersApi;
  public readonly items: ItemsApi;
  public readonly version: VersionApi;
  public readonly auth: AuthApi;

  constructor() {
    // Feeds endpoint group implementation
    this.feeds = {
      getAll: async () => {
        const response = await baseApiGet<FeedsResponse>('/feeds');
        return {
          feeds: response.feeds.map(normalizeFeed),
          starredCount: response.starredCount ?? 0,
          newestItemId: response.newestItemId ?? null,
        };
      },

      create: async (url: string, folderId: number | null = null) => {
        const response = await baseApiPost<{ feeds: ApiFeed[]; newestItemId: number | null }>(
          '/feeds',
          {
            url,
            folderId,
          },
        );
        const feeds = response.feeds;
        if (feeds.length === 0) {
          throw new Error('No feed returned from create');
        }
        return {
          feed: normalizeFeed(feeds[0]),
          newestItemId: response.newestItemId,
        };
      },

      delete: async (feedId: number) => {
        await baseApiDelete(`/feeds/${String(feedId)}`);
      },

      move: async (feedId: number, folderId: number | null) => {
        await baseApiPost(`/feeds/${String(feedId)}/move`, { folderId });
      },

      rename: async (feedId: number, feedTitle: string) => {
        await baseApiPost(`/feeds/${String(feedId)}/rename`, { feedTitle });
      },

      markRead: async (feedId: number, newestItemId: number) => {
        await baseApiPost(`/feeds/${String(feedId)}/read`, { newestItemId });
      },
    };

    // Folders endpoint group implementation
    this.folders = {
      getAll: async () => {
        const response = await baseApiGet<FoldersResponse>('/folders');
        return response.folders.map(normalizeFolder);
      },

      create: async (name: string) => {
        const response = await baseApiPost<FoldersResponse>('/folders', { name });
        const folders = response.folders.map(normalizeFolder);
        if (folders.length === 0) {
          throw new Error('No folder returned from create operation');
        }
        return folders[0];
      },

      rename: async (folderId: number, name: string) => {
        await baseApiPut(`/folders/${String(folderId)}`, { name });
      },

      delete: async (folderId: number) => {
        await baseApiDelete(`/folders/${String(folderId)}`);
      },

      markRead: async (folderId: number, newestItemId: number) => {
        await baseApiPost(`/folders/${String(folderId)}/read`, { newestItemId });
      },
    };

    // Items endpoint group implementation
    this.items = {
      get: async (params: ItemsQueryParams = {}, options?: ApiRequestOptions) => {
        const query = buildItemsQuery({
          batchSize: CONFIG.DEFAULT_BATCH_SIZE,
          type: ItemFilterType.ALL,
          getRead: false,
          ...params,
        });
        const response = await baseApiGet<ItemsResponse>(`/items${query}`, options);
        return response.items.map(normalizeArticle);
      },

      getById: async (id: number) => {
        const items = await this.items.get({ id, getRead: true, batchSize: 1 });
        return items[0] ?? null;
      },

      getContent: async (id: number) => {
        try {
          const response = await baseApiGet<string>(`/items/${String(id)}/content`, {
            responseType: 'text',
          });
          const trimmed = response.trim();
          if (!trimmed) {
            return '';
          }

          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed) as {
                content?: string | null;
                body?: string | null;
              };
              if (typeof parsed === 'object') {
                return parsed.content ?? parsed.body ?? '';
              }
            } catch {
              // Fall through to treat as raw HTML/text.
            }
          }

          return response;
        } catch (error) {
          if (error instanceof ApiError && error.statusCode === 404) {
            return null;
          }
          throw error;
        }
      },

      getUpdated: async (
        lastModified: number,
        type: ItemFilterType = ItemFilterType.ALL,
        id = 0,
      ) => {
        const params = new URLSearchParams({
          lastModified: String(lastModified),
          type: String(type),
          id: String(id),
        });
        const response = await baseApiGet<ItemsResponse>(`/items/updated?${params.toString()}`);
        return response.items.map(normalizeArticle);
      },

      markRead: async (itemId: number) => {
        await baseApiPost(`/items/${String(itemId)}/read`);
      },

      markUnread: async (itemId: number) => {
        await baseApiPost(`/items/${String(itemId)}/unread`);
      },

      star: async (itemId: number) => {
        await baseApiPost(`/items/${String(itemId)}/star`);
      },

      unstar: async (itemId: number) => {
        await baseApiPost(`/items/${String(itemId)}/unstar`);
      },

      markMultipleRead: async (itemIds: number[]) => {
        await baseApiPost('/items/read/multiple', { itemIds });
      },

      markMultipleUnread: async (itemIds: number[]) => {
        await baseApiPost('/items/unread/multiple', { itemIds });
      },

      starMultiple: async (itemIds: number[]) => {
        await baseApiPost('/items/star/multiple', { itemIds });
      },

      unstarMultiple: async (itemIds: number[]) => {
        await baseApiPost('/items/unstar/multiple', { itemIds });
      },

      markAllRead: async (newestItemId: number) => {
        await baseApiPost('/items/read', { newestItemId });
      },
    };

    // Version endpoint group implementation
    this.version = {
      get: async () => {
        try {
          const response = await fetch(`${CONFIG.API_PATH}/version`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          });

          // Handle error responses
          if (!response.ok) {
            throw new ApiError(response.status, response.statusText);
          }

          // Parse and return JSON response
          const data = (await response.json()) as VersionResponse;
          return data;
        } catch (error) {
          // CORS errors (typically TypeError with specific message patterns)
          if (error instanceof TypeError) {
            const errorMessage = error.message.toLowerCase();

            // Check for common CORS error patterns
            if (
              errorMessage.includes('cors') ||
              errorMessage.includes('access-control-allow-origin') ||
              errorMessage.includes('cross-origin')
            ) {
              throw new NetworkError(
                'Server is not configured to allow cross-origin requests from this application. ' +
                  'Please ensure CORS is properly configured on the server with Access-Control-Allow-Origin headers.',
              );
            }

            // Generic network error
            throw new NetworkError(
              'Unable to connect to server. Please check the URL and your network connection.',
            );
          }

          if (error instanceof ApiError) {
            throw error;
          }

          // Unknown errors
          throw new NetworkError('An unexpected error occurred while connecting to the server.');
        }
      },
    };

    // Auth utilities implementation
    this.auth = {
      validateCredentials: async (username: string, password: string, rememberDevice: boolean) => {
        return baseValidateCredentials(username, password, rememberDevice);
      },
      issueToken: async (username: string, password: string, rememberDevice: boolean) =>
        baseIssueToken(username, password, rememberDevice),
      logout: async () => baseRevokeCurrentToken(),
    };
  }
}

/**
 * Singleton instance of the API client.
 */
let _instance: ApiClient | null = null;

/**
 * Gets the singleton API client instance.
 */
export function getApiClient(): ApiClient {
  _instance ??= new ApiClientImpl();
  return _instance;
}

/**
 * Creates a new API client instance (useful for testing with mocks).
 */
export function createApiClient(): ApiClient {
  return new ApiClientImpl();
}

/**
 * Resets the singleton instance (useful for testing).
 */
export function resetApiClient(): void {
  _instance = null;
}

/**
 * Default export for convenience.
 */
export const api = getApiClient();
