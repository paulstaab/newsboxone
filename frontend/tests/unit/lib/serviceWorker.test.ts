import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

interface FetchEventLike {
  request: {
    destination: string;
    method: string;
    mode: string;
    url: string;
  };
  respondWith: ReturnType<typeof vi.fn>;
}

async function loadFetchHandler(): Promise<(event: FetchEventLike) => void> {
  const source = await readFile(new URL('../../../public/sw.js', import.meta.url), 'utf8');
  const listeners = new Map<string, (event: FetchEventLike) => void>();

  vm.runInNewContext(source, {
    URL,
    caches: {
      keys: vi.fn(),
      match: vi.fn().mockResolvedValue(undefined),
      open: vi.fn(),
    },
    fetch: vi.fn().mockResolvedValue({ ok: false }),
    self: {
      addEventListener: (type: string, listener: (event: FetchEventLike) => void) => {
        listeners.set(type, listener);
      },
      clients: { claim: vi.fn() },
      location: { origin: 'https://reader.example' },
      registration: { scope: 'https://reader.example/' },
      skipWaiting: vi.fn(),
    },
  });

  const handler = listeners.get('fetch');
  if (!handler) throw new Error('service worker did not register a fetch handler');
  return handler;
}

describe('service worker fetch handling', () => {
  it('does not intercept cross-origin publisher images', async () => {
    const handler = await loadFetchHandler();
    const respondWith = vi.fn();

    handler({
      request: {
        destination: 'image',
        method: 'GET',
        mode: 'no-cors',
        url: 'https://publisher.example/image.jpg',
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it('continues to cache same-origin static images', async () => {
    const handler = await loadFetchHandler();
    const respondWith = vi.fn();

    handler({
      request: {
        destination: 'image',
        method: 'GET',
        mode: 'no-cors',
        url: 'https://reader.example/icon.png',
      },
      respondWith,
    });

    expect(respondWith).toHaveBeenCalledOnce();
  });
});
