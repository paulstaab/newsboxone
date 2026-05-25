/**
 * Typed domain implementation for the Items API.
 */

import { ApiError, apiGet, apiPost, type ApiRequestOptions } from './client';
import type { ItemsApi } from './types';
import {
  ItemFilterType,
  type ItemsQueryParams,
  type ItemsResponse,
  normalizeArticle,
} from '@/types';
import { CONFIG } from '@/lib/config/env';

/**
 * Builds query string from item query parameters.
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
 * Item endpoint group implementation.
 */
export const itemsApi: ItemsApi = {
  get: async (params: ItemsQueryParams = {}, options?: ApiRequestOptions) => {
    const query = buildItemsQuery({
      batchSize: CONFIG.DEFAULT_BATCH_SIZE,
      type: ItemFilterType.ALL,
      getRead: false,
      ...params,
    });
    const response = await apiGet<ItemsResponse>(`/items${query}`, options);
    return response.items.map(normalizeArticle);
  },

  getById: async (id: number) => {
    const items = await itemsApi.get({ id, getRead: true, batchSize: 1 });
    return items[0] ?? null;
  },

  getContent: async (id: number) => {
    try {
      const response = await apiGet<string>(`/items/${String(id)}/content`, {
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

  getUpdated: async (lastModified: number, type: ItemFilterType = ItemFilterType.ALL, id = 0) => {
    const params = new URLSearchParams({
      lastModified: String(lastModified),
      type: String(type),
      id: String(id),
    });
    const response = await apiGet<ItemsResponse>(`/items/updated?${params.toString()}`);
    return response.items.map(normalizeArticle);
  },

  markRead: async (itemId: number) => {
    await apiPost(`/items/${String(itemId)}/read`);
  },

  markUnread: async (itemId: number) => {
    await apiPost(`/items/${String(itemId)}/unread`);
  },

  star: async (itemId: number) => {
    await apiPost(`/items/${String(itemId)}/star`);
  },

  unstar: async (itemId: number) => {
    await apiPost(`/items/${String(itemId)}/unstar`);
  },

  markMultipleRead: async (itemIds: number[]) => {
    await apiPost('/items/read/multiple', { itemIds });
  },

  markMultipleUnread: async (itemIds: number[]) => {
    await apiPost('/items/unread/multiple', { itemIds });
  },

  starMultiple: async (itemIds: number[]) => {
    await apiPost('/items/star/multiple', { itemIds });
  },

  unstarMultiple: async (itemIds: number[]) => {
    await apiPost('/items/unstar/multiple', { itemIds });
  },

  markAllRead: async (newestItemId: number) => {
    await apiPost('/items/read', { newestItemId });
  },
};
