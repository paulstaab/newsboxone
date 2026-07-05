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

const SAFE_HTML_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
]);

const GLOBAL_SAFE_ATTRIBUTES = new Set(['aria-label', 'dir', 'lang', 'title']);
const LINK_SAFE_ATTRIBUTES = new Set(['href', 'title']);
const IMAGE_SAFE_ATTRIBUTES = new Set(['alt', 'height', 'src', 'title', 'width']);
const TABLE_SAFE_ATTRIBUTES = new Set(['colspan', 'rowspan', 'scope']);

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./')) return true;

  try {
    const parsed = new URL(trimmed, 'https://newsboxone.local');
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeAttribute(tagName: string, attributeName: string): boolean {
  if (GLOBAL_SAFE_ATTRIBUTES.has(attributeName)) return true;
  if (tagName === 'a') return LINK_SAFE_ATTRIBUTES.has(attributeName);
  if (tagName === 'img') return IMAGE_SAFE_ATTRIBUTES.has(attributeName);
  if (['td', 'th'].includes(tagName)) return TABLE_SAFE_ATTRIBUTES.has(attributeName);
  return false;
}

function sanitizeNode(source: Node, targetDocument: Document): Node | null {
  if (source.nodeType === Node.TEXT_NODE) {
    return targetDocument.createTextNode(source.textContent ?? '');
  }

  if (source.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const sourceElement = source as Element;
  const tagName = sourceElement.tagName.toLowerCase();
  const sanitizedChildren = Array.from(sourceElement.childNodes)
    .map((child) => sanitizeNode(child, targetDocument))
    .filter((child): child is Node => child !== null);

  if (!SAFE_HTML_TAGS.has(tagName)) {
    const fragment = targetDocument.createDocumentFragment();
    for (const child of sanitizedChildren) {
      fragment.appendChild(child);
    }
    return fragment;
  }

  const element = targetDocument.createElement(tagName);
  for (const attribute of Array.from(sourceElement.attributes)) {
    const attributeName = attribute.name.toLowerCase();
    if (attributeName.startsWith('on') || attributeName === 'style') continue;
    if (!isSafeAttribute(tagName, attributeName)) continue;
    if ((attributeName === 'href' || attributeName === 'src') && !isSafeUrl(attribute.value)) {
      continue;
    }
    element.setAttribute(attributeName, attribute.value);
  }

  if (tagName === 'a' && element.hasAttribute('href')) {
    element.setAttribute('rel', 'noopener noreferrer');
  }

  for (const child of sanitizedChildren) {
    element.appendChild(child);
  }

  return element;
}

/**
 * Sanitizes publisher-controlled article HTML before it can be rendered.
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html.trim()) return '';
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, '');
  }

  const parser = new DOMParser();
  const sourceDocument = parser.parseFromString(html, 'text/html');
  const targetDocument = document.implementation.createHTMLDocument('sanitized-article');
  const fragment = targetDocument.createDocumentFragment();

  for (const child of Array.from(sourceDocument.body.childNodes)) {
    const sanitized = sanitizeNode(child, targetDocument);
    if (sanitized) {
      fragment.appendChild(sanitized);
    }
  }

  const container = targetDocument.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}

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
            return sanitizeArticleHtml(parsed.content ?? parsed.body ?? '');
          }
        } catch {
          // Fall through to treat as raw HTML/text.
        }
      }

      return sanitizeArticleHtml(response);
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
