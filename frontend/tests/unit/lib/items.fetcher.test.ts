import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { itemsApi, sanitizeArticleHtml } from '@/lib/api/items';
import { ApiError, AuthenticationError, NetworkError } from '@/lib/api/client';
import { CONFIG } from '@/lib/config/env';
import { clearSession, storeSession } from '@/lib/storage';
import { ItemFilterType } from '@/types';
import { buildApiArticle } from '../../fixtures/apiBuilders';
import { server } from '../../mocks/server';

function storeTestSession() {
  storeSession({
    username: 'reader',
    token: 'test-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rememberDevice: true,
  });
}

describe('itemsApi.get', () => {
  beforeEach(() => {
    clearSession();
    storeTestSession();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearSession();
  });

  it('fetches unread items with default query parameters and bearer auth', async () => {
    expect.assertions(6);

    server.use(
      http.get('/api/items', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('batchSize')).toBe(String(CONFIG.DEFAULT_BATCH_SIZE));
        expect(url.searchParams.get('type')).toBe(String(ItemFilterType.ALL));
        expect(url.searchParams.get('getRead')).toBe('false');
        expect(request.headers.get('authorization')).toBe('Bearer test-token');
        return HttpResponse.json({ items: [buildApiArticle({ id: 101 })] });
      }),
    );

    const items = await itemsApi.get();

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(101);
  });

  it('passes pagination and filtering query parameters', async () => {
    expect.assertions(5);

    server.use(
      http.get('/api/items', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('batchSize')).toBe('25');
        expect(url.searchParams.get('offset')).toBe('42');
        expect(url.searchParams.get('type')).toBe(String(ItemFilterType.FEED));
        expect(url.searchParams.get('id')).toBe('10');
        expect(url.searchParams.get('getRead')).toBe('true');
        return HttpResponse.json({ items: [] });
      }),
    );

    await itemsApi.get({
      batchSize: 25,
      offset: 42,
      type: ItemFilterType.FEED,
      id: 10,
      getRead: true,
    });
  });

  it('raises AuthenticationError and clears stale sessions on 401', async () => {
    server.use(
      http.get('/api/items', () => HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })),
    );

    await expect(itemsApi.get()).rejects.toBeInstanceOf(AuthenticationError);
    expect(localStorage.getItem(CONFIG.SESSION_KEY)).toBeNull();
  });

  it('maps network failures to NetworkError', async () => {
    server.use(http.get('/api/items', () => HttpResponse.error()));

    await expect(itemsApi.get({}, { noRetry: true })).rejects.toBeInstanceOf(NetworkError);
  });

  it('retries transient API failures before returning items', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let attempts = 0;
    server.use(
      http.get('/api/items', () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ detail: 'temporary' }, { status: 500 });
        }
        return HttpResponse.json({ items: [buildApiArticle({ id: 202 })] });
      }),
    );

    const items = await itemsApi.get({}, { maxRetries: 1 });

    expect(attempts).toBe(2);
    expect(items[0]?.id).toBe(202);
  });

  it('surfaces non-retryable API errors', async () => {
    server.use(
      http.get('/api/items', () => HttpResponse.json({ detail: 'bad request' }, { status: 400 })),
    );

    await expect(itemsApi.get()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('itemsApi.getContent', () => {
  beforeEach(() => {
    clearSession();
    storeTestSession();
  });

  afterEach(() => {
    clearSession();
  });

  it('returns sanitized article content from JSON responses', async () => {
    server.use(
      http.get('/api/items/:id/content', () =>
        HttpResponse.text(
          JSON.stringify({
            content:
              '<h2 onclick="alert(1)">Safe</h2><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>',
          }),
        ),
      ),
    );

    const content = await itemsApi.getContent(100);

    expect(content).toContain('<h2>Safe</h2>');
    expect(content).not.toContain('script');
    expect(content).not.toContain('onclick');
    expect(content).not.toContain('javascript:');
    expect(content).toContain('href="https://example.com"');
    expect(content).toContain('rel="noopener noreferrer"');
  });

  it('returns null for missing content resources', async () => {
    server.use(
      http.get('/api/items/:id/content', () =>
        HttpResponse.json({ detail: 'missing' }, { status: 404 }),
      ),
    );

    await expect(itemsApi.getContent(404)).resolves.toBeNull();
  });
});

describe('sanitizeArticleHtml', () => {
  it('keeps safe article markup and strips active content', () => {
    const sanitized = sanitizeArticleHtml(
      '<p style="color:red">Hello <strong>reader</strong></p><img src="https://example.com/a.png" onerror="alert(1)"><iframe src="https://evil.example"></iframe><form><input value="x"></form>',
    );

    expect(sanitized).toContain('<p>Hello <strong>reader</strong></p>');
    expect(sanitized).toContain('<img src="https://example.com/a.png">');
    expect(sanitized).not.toContain('style=');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('<form>');
    expect(sanitized).not.toContain('<input');
  });
});
