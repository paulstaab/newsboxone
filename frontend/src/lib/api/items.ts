/**
 * Typed domain wrapper for the Items API.
 * Aligned with contracts/items.md
 *
 * Re-exports from the centralized API client for backward compatibility.
 */

import { api } from './apiClient';
import { ItemFilterType } from '@/types';
import type { Article, ItemsQueryParams } from '@/types';
import type { ApiRequestOptions } from './client';

/**
 * Fetches items with optional filtering and pagination.
 */
export async function getItems(
  params: ItemsQueryParams = {},
  options?: ApiRequestOptions,
): Promise<Article[]> {
  return api.items.get(params, options);
}

/**
 * Fetches a single article by ID.
 */
export async function getArticle(id: number): Promise<Article | null> {
  return api.items.getById(id);
}

/**
 * Fetches full article content HTML (if available).
 */
export async function getArticleContent(id: number): Promise<string | null> {
  return api.items.getContent(id);
}

/**
 * Fetches items modified since a specific timestamp.
 */
export async function getUpdatedItems(
  lastModified: number,
  type: ItemFilterType = ItemFilterType.ALL,
  id = 0,
): Promise<Article[]> {
  return api.items.getUpdated(lastModified, type, id);
}

/**
 * Marks a single item as read.
 */
export async function markItemRead(itemId: number): Promise<void> {
  return api.items.markRead(itemId);
}

/**
 * Marks a single item as unread.
 */
export async function markItemUnread(itemId: number): Promise<void> {
  return api.items.markUnread(itemId);
}

/**
 * Stars a single item.
 */
export async function starItem(itemId: number): Promise<void> {
  return api.items.star(itemId);
}

/**
 * Unstars a single item.
 */
export async function unstarItem(itemId: number): Promise<void> {
  return api.items.unstar(itemId);
}

/**
 * Marks multiple items as read.
 */
export async function markItemsRead(itemIds: number[]): Promise<void> {
  return api.items.markMultipleRead(itemIds);
}

/**
 * Marks multiple items as unread.
 */
export async function markItemsUnread(itemIds: number[]): Promise<void> {
  return api.items.markMultipleUnread(itemIds);
}

/**
 * Stars multiple items.
 */
export async function starItems(itemIds: number[]): Promise<void> {
  return api.items.starMultiple(itemIds);
}

/**
 * Unstars multiple items.
 */
export async function unstarItems(itemIds: number[]): Promise<void> {
  return api.items.unstarMultiple(itemIds);
}

/**
 * Marks all items as read up to a specific item ID.
 */
export async function markAllItemsRead(newestItemId: number): Promise<void> {
  return api.items.markAllRead(newestItemId);
}
