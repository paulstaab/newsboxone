/** Browser-only client for the Karakeep REST API. */

export type KarakeepErrorCode =
  'invalid-url' | 'mixed-content' | 'authentication' | 'network-or-cors' | 'server';

export class KarakeepError extends Error {
  constructor(
    public readonly code: KarakeepErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'KarakeepError';
  }
}

export interface KarakeepConfig {
  baseUrl: string;
  apiToken: string;
}

export interface KarakeepBookmark {
  url: string;
  title: string;
  summary: string;
}

interface KarakeepBookmarkResponse {
  id: string;
}

/** Normalizes a Karakeep host URL to its v1 API base URL. */
export function normalizeKarakeepBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new KarakeepError('invalid-url', 'Enter a valid Karakeep URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new KarakeepError('invalid-url', 'Enter an HTTP or HTTPS Karakeep URL.');
  }

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    url.protocol === 'http:'
  ) {
    throw new KarakeepError(
      'mixed-content',
      'An HTTPS NewsBoxOne page cannot connect to Karakeep over HTTP.',
    );
  }

  url.search = '';
  url.hash = '';
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname.endsWith('/api/v1') ? pathname : `${pathname}/api/v1`;
  return url.toString().replace(/\/$/, '');
}

function getHeaders(apiToken: string): Record<string, string> {
  const token = apiToken.trim();
  if (!token) {
    throw new KarakeepError('authentication', 'Enter a Karakeep API key.');
  }
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function karakeepFetch(config: KarakeepConfig, path: string, init?: RequestInit) {
  const baseUrl = normalizeKarakeepBaseUrl(config.baseUrl);
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(getHeaders(config.apiToken))) {
    headers.set(key, value);
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new KarakeepError(
      'network-or-cors',
      'Could not reach Karakeep. Check its address, certificate, network access, and CORS settings.',
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new KarakeepError('authentication', 'Karakeep rejected the API key.');
  }
  return response;
}

/** Verifies browser reachability and API-key access without changing Karakeep data. */
export async function testKarakeepConnection(config: KarakeepConfig): Promise<string> {
  const normalizedBaseUrl = normalizeKarakeepBaseUrl(config.baseUrl);
  const response = await karakeepFetch(
    { ...config, baseUrl: normalizedBaseUrl },
    '/bookmarks?limit=1&includeContent=false',
  );
  if (!response.ok) {
    throw new KarakeepError('server', `Karakeep returned HTTP ${String(response.status)}.`);
  }
  return normalizedBaseUrl;
}

/** Saves a link bookmark to Karakeep. Existing bookmarks are also considered successful. */
export async function saveKarakeepBookmark(
  config: KarakeepConfig,
  bookmark: KarakeepBookmark,
): Promise<string> {
  const response = await karakeepFetch(config, '/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'link',
      url: bookmark.url,
      title: bookmark.title,
      summary: bookmark.summary,
      source: 'api',
      crawlPriority: 'normal',
    }),
  });
  if (response.status !== 200 && response.status !== 201) {
    throw new KarakeepError(
      'server',
      `Karakeep could not save the article (HTTP ${String(response.status)}).`,
    );
  }
  let savedBookmark: KarakeepBookmarkResponse;
  try {
    savedBookmark = (await response.json()) as KarakeepBookmarkResponse;
  } catch {
    throw new KarakeepError('server', 'Karakeep returned an invalid bookmark response.');
  }
  if (typeof savedBookmark.id !== 'string' || !savedBookmark.id) {
    throw new KarakeepError('server', 'Karakeep did not return a bookmark ID.');
  }
  return savedBookmark.id;
}

/** Permanently deletes a bookmark from Karakeep. */
export async function deleteKarakeepBookmark(
  config: KarakeepConfig,
  bookmarkId: string,
): Promise<void> {
  const response = await karakeepFetch(config, `/bookmarks/${encodeURIComponent(bookmarkId)}`, {
    method: 'DELETE',
  });
  if (response.status !== 204) {
    throw new KarakeepError(
      'server',
      `Karakeep could not delete the article (HTTP ${String(response.status)}).`,
    );
  }
}
