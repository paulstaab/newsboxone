/**
 * Composed API client singleton.
 */

import { authApi } from './auth';
import { feedsApi } from './feeds';
import { foldersApi } from './folders';
import { itemsApi } from './items';
import type { ApiClient } from './types';
import { versionApi } from './version';

export type {
  ApiClient,
  AuthApi,
  FeedsApi,
  FoldersApi,
  ItemsApi,
  VersionApi,
  VersionResponse,
} from './types';

/**
 * Creates a new API client instance.
 */
export function createApiClient(): ApiClient {
  return {
    feeds: feedsApi,
    folders: foldersApi,
    items: itemsApi,
    version: versionApi,
    auth: authApi,
  };
}

let instance: ApiClient | null = null;

/**
 * Gets the singleton API client instance.
 */
export function getApiClient(): ApiClient {
  instance ??= createApiClient();
  return instance;
}

/**
 * Resets the singleton instance for tests.
 */
export function resetApiClient(): void {
  instance = null;
}

/**
 * Default composed API client.
 */
export const api = getApiClient();
