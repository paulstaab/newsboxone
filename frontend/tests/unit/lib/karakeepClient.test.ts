import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteKarakeepBookmark,
  KarakeepError,
  normalizeKarakeepBaseUrl,
  saveKarakeepBookmark,
  testKarakeepConnection,
} from '@/lib/karakeep/client';

describe('Karakeep browser client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes Karakeep host URLs to the v1 API base', () => {
    expect(normalizeKarakeepBaseUrl('https://karakeep.example')).toBe(
      'https://karakeep.example/api/v1',
    );
    expect(normalizeKarakeepBaseUrl('https://karakeep.example/api/v1/')).toBe(
      'https://karakeep.example/api/v1',
    );
  });

  it('rejects unsupported URLs and credential-bearing URLs', () => {
    expect(() => normalizeKarakeepBaseUrl('ftp://karakeep.example')).toThrow(KarakeepError);
    expect(() => normalizeKarakeepBaseUrl('https://user:pass@karakeep.example')).toThrow(
      KarakeepError,
    );
  });

  it('tests the connection with bearer authentication', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await expect(
      testKarakeepConnection({
        baseUrl: 'https://karakeep.example',
        apiToken: 'token',
      }),
    ).resolves.toBe('https://karakeep.example/api/v1');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(requestUrl).toBe(
      'https://karakeep.example/api/v1/bookmarks?limit=1&includeContent=false',
    );
    expect(requestInit?.headers).toBeInstanceOf(Headers);
    const headers = requestInit?.headers as Headers;
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token');
  });

  it('saves link bookmarks and treats existing bookmarks as success', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"bookmark-123"}', { status: 200 }));

    await expect(
      saveKarakeepBookmark(
        { baseUrl: 'https://karakeep.example', apiToken: 'token' },
        {
          url: 'https://example.com/story',
          title: 'Story',
          summary: 'Summary',
        },
      ),
    ).resolves.toBe('bookmark-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://karakeep.example/api/v1/bookmarks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'link',
          url: 'https://example.com/story',
          title: 'Story',
          summary: 'Summary',
          source: 'api',
          crawlPriority: 'normal',
        }),
      }),
    );
  });

  it('deletes bookmarks by their Karakeep ID', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteKarakeepBookmark(
      { baseUrl: 'https://karakeep.example', apiToken: 'token' },
      'bookmark/123',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://karakeep.example/api/v1/bookmarks/bookmark%2F123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('maps failed Karakeep calls to typed errors', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(
      saveKarakeepBookmark(
        { baseUrl: 'https://karakeep.example', apiToken: 'token' },
        {
          url: 'https://example.com/story',
          title: 'Story',
          summary: 'Summary',
        },
      ),
    ).rejects.toMatchObject({ code: 'authentication' });
  });
});
