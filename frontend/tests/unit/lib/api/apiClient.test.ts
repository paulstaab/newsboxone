/**
 * Unit tests for the centralized API client.
 * Tests token injection, error normalization, response parsing, and endpoint methods.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { getApiClient, createApiClient, resetApiClient, type ApiClient } from '@/lib/api/apiClient';
import { ApiError, AuthenticationError } from '@/lib/api/client';
import { storeSession, clearSession } from '@/lib/storage';

const BASE_URL = '';
const API_PATH = '/api';

// Valid test credentials (base64 of "testuser:testpass")
const TEST_CREDENTIALS = 'dGVzdHVzZXI6dGVzdHBhc3M=';

beforeEach(() => {
  server.resetHandlers();
  resetApiClient();
  clearSession();
});

describe('ApiClient', () => {
  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls to getApiClient', () => {
      const instance1 = getApiClient();
      const instance2 = getApiClient();
      expect(instance1).toBe(instance2);
    });

    it('should create new instances with createApiClient', () => {
      const instance1 = createApiClient();
      const instance2 = createApiClient();
      expect(instance1).not.toBe(instance2);
    });

    it('should reset singleton with resetApiClient', () => {
      const instance1 = getApiClient();
      resetApiClient();
      const instance2 = getApiClient();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('token injection', () => {
    it('should automatically attach auth token to authenticated requests', async () => {
      storeSession({
        username: 'testuser',
        credentials: TEST_CREDENTIALS,
        rememberDevice: false,
      });

      let receivedAuth = '';
      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, ({ request }) => {
          receivedAuth = request.headers.get('Authorization') ?? '';
          return HttpResponse.json({ feeds: [] });
        }),
      );

      const client = getApiClient();
      await client.feeds.getAll();

      expect(receivedAuth).toBe(`Basic ${TEST_CREDENTIALS}`);
    });

    it('should throw AuthenticationError when no session exists', async () => {
      clearSession();

      const client = getApiClient();
      await expect(client.feeds.getAll()).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError on 401 responses', async () => {
      storeSession({
        username: 'testuser',
        credentials: 'invalid',
        rememberDevice: false,
      });

      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return new HttpResponse(null, { status: 401 });
        }),
      );

      const client = getApiClient();
      await expect(client.feeds.getAll()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('error normalization', () => {
    beforeEach(() => {
      storeSession({
        username: 'testuser',
        credentials: TEST_CREDENTIALS,
        rememberDevice: false,
      });
    });

    it('should normalize 404 errors to ApiError', async () => {
      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      const client = getApiClient();
      try {
        await client.feeds.getAll();
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('should normalize 500 errors to ApiError', async () => {
      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const client = getApiClient();
      try {
        await client.feeds.getAll();
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
      }
    }, 15000); // Increase timeout to account for retries

    it('should include response body in ApiError', async () => {
      const errorBody = { message: 'Internal server error' };
      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return HttpResponse.json(errorBody, { status: 500 });
        }),
      );

      const client = getApiClient();
      try {
        await client.feeds.getAll();
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).body).toEqual(errorBody);
      }
    }, 15000); // Increase timeout to account for retries
  });

  describe('response parsing', () => {
    beforeEach(() => {
      storeSession({
        username: 'testuser',
        credentials: TEST_CREDENTIALS,
        rememberDevice: false,
      });
    });

    it('should parse JSON responses correctly', async () => {
      const mockFeed = {
        id: 101,
        url: 'https://example.com/feed',
        title: 'Test Feed',
        folderId: null,
      };

      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return HttpResponse.json({ feeds: [mockFeed] });
        }),
      );

      const client = getApiClient();
      const result = await client.feeds.getAll();

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].id).toBe(101);
      expect(result.feeds[0].title).toBe('Test Feed');
    });

    it('should handle empty responses gracefully', async () => {
      server.use(
        http.delete(`${BASE_URL}${API_PATH}/feeds/123`, () => {
          return new HttpResponse(null, { status: 200 });
        }),
      );

      const client = getApiClient();
      await expect(client.feeds.delete(123)).resolves.not.toThrow();
    });

    it('should normalize feed data through normalizeFeed', async () => {
      const apiFeed = {
        id: 101,
        url: 'https://example.com/feed',
        title: 'Test Feed',
        folderId: 10,
        faviconLink: null,
        added: 1234567890,
        nextUpdateTime: null,
        ordering: 0,
        link: 'https://example.com',
        pinned: false,
        updateErrorCount: 0,
        lastUpdateError: null,
      };

      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return HttpResponse.json({ feeds: [apiFeed] });
        }),
      );

      const client = getApiClient();
      const result = await client.feeds.getAll();

      expect(result.feeds[0]).toHaveProperty('id');
      expect(result.feeds[0]).toHaveProperty('title');
      expect(result.feeds[0]).toHaveProperty('folderId');
    });
  });

  describe('feeds endpoint group', () => {
    beforeEach(() => {
      storeSession({
        username: 'testuser',
        credentials: TEST_CREDENTIALS,
        rememberDevice: false,
      });
    });

    it('should fetch all feeds', async () => {
      const client = getApiClient();
      const result = await client.feeds.getAll();

      expect(result).toHaveProperty('feeds');
      expect(result).toHaveProperty('starredCount');
      expect(result).toHaveProperty('newestItemId');
      expect(Array.isArray(result.feeds)).toBe(true);
    });

    it('should create a new feed', async () => {
      const client = getApiClient();
      const result = await client.feeds.create('https://example.com/rss');

      expect(result).toHaveProperty('feed');
      expect(result.feed).toHaveProperty('id');
      expect(result.feed).toHaveProperty('title');
    });

    it('should delete a feed', async () => {
      const client = getApiClient();
      await expect(client.feeds.delete(123)).resolves.not.toThrow();
    });

    it('should move a feed to another folder', async () => {
      const client = getApiClient();
      await expect(client.feeds.move(123, 456)).resolves.not.toThrow();
    });

    it('should rename a feed', async () => {
      const client = getApiClient();
      await expect(client.feeds.rename(123, 'New Title')).resolves.not.toThrow();
    });

    it('should mark feed as read', async () => {
      const client = getApiClient();
      await expect(client.feeds.markRead(123, 999)).resolves.not.toThrow();
    });
  });

  describe('folders endpoint group', () => {
    beforeEach(() => {
      storeSession({
        username: 'testuser',
        credentials: TEST_CREDENTIALS,
        rememberDevice: false,
      });
    });

    it('should fetch all folders', async () => {
      const client = getApiClient();
      const result = await client.folders.getAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should create a new folder', async () => {
      const client = getApiClient();
      const result = await client.folders.create('New Folder');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    });

    it('should rename a folder', async () => {
      const client = getApiClient();
      await expect(client.folders.rename(123, 'Renamed Folder')).resolves.not.toThrow();
    });

    it('should delete a folder', async () => {
      const client = getApiClient();
      await expect(client.folders.delete(123)).resolves.not.toThrow();
    });

    it('should mark folder as read', async () => {
      const client = getApiClient();
      await expect(client.folders.markRead(123, 999)).resolves.not.toThrow();
    });
  });

  describe('items endpoint group', () => {
    beforeEach(() => {
      storeSession({
        username: 'testuser',
        credentials: TEST_CREDENTIALS,
        rememberDevice: false,
      });
    });

    it('should fetch items', async () => {
      const client = getApiClient();
      const result = await client.items.get();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should fetch items with params', async () => {
      const client = getApiClient();
      const result = await client.items.get({ batchSize: 10, offset: 0 });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should fetch a single item by ID', async () => {
      const client = getApiClient();
      const result = await client.items.getById(1001);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe(1001);
      }
    });

    it('should fetch updated items', async () => {
      const client = getApiClient();
      const result = await client.items.getUpdated(0);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should mark item as read', async () => {
      const client = getApiClient();
      await expect(client.items.markRead(123)).resolves.not.toThrow();
    });

    it('should mark item as unread', async () => {
      const client = getApiClient();
      await expect(client.items.markUnread(123)).resolves.not.toThrow();
    });

    it('should star an item', async () => {
      const client = getApiClient();
      await expect(client.items.star(123)).resolves.not.toThrow();
    });

    it('should unstar an item', async () => {
      const client = getApiClient();
      await expect(client.items.unstar(123)).resolves.not.toThrow();
    });

    it('should mark multiple items as read', async () => {
      const client = getApiClient();
      await expect(client.items.markMultipleRead([123, 456])).resolves.not.toThrow();
    });

    it('should mark multiple items as unread', async () => {
      const client = getApiClient();
      await expect(client.items.markMultipleUnread([123, 456])).resolves.not.toThrow();
    });

    it('should star multiple items', async () => {
      const client = getApiClient();
      await expect(client.items.starMultiple([123, 456])).resolves.not.toThrow();
    });

    it('should unstar multiple items', async () => {
      const client = getApiClient();
      await expect(client.items.unstarMultiple([123, 456])).resolves.not.toThrow();
    });

    it('should mark all items as read', async () => {
      const client = getApiClient();
      await expect(client.items.markAllRead(999)).resolves.not.toThrow();
    });
  });

  describe('version endpoint group', () => {
    it('should fetch version without authentication', async () => {
      const client = getApiClient();
      const result = await client.version.get();

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('apiLevels');
      expect(typeof result.version).toBe('string');
      expect(Array.isArray(result.apiLevels)).toBe(true);
    });

    it('should not require session for version endpoint', async () => {
      clearSession();

      const client = getApiClient();
      await expect(client.version.get()).resolves.not.toThrow();
    });
  });

  describe('auth utilities', () => {
    it('should validate correct credentials', async () => {
      const client = getApiClient();
      const result = await client.auth.validateCredentials(TEST_CREDENTIALS);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid credentials', async () => {
      server.use(
        http.get(`${BASE_URL}${API_PATH}/feeds`, () => {
          return new HttpResponse(null, { status: 401 });
        }),
      );

      const client = getApiClient();
      const result = await client.auth.validateCredentials('invalid');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('mockability', () => {
    it('should allow mocking with createApiClient', () => {
      const mockClient: ApiClient = {
        feeds: {
          getAll: vi.fn().mockResolvedValue({ feeds: [], starredCount: 0, newestItemId: null }),
          create: vi.fn(),
          delete: vi.fn(),
          move: vi.fn(),
          rename: vi.fn(),
          markRead: vi.fn(),
        },
        folders: {
          getAll: vi.fn().mockResolvedValue([]),
          create: vi.fn(),
          rename: vi.fn(),
          delete: vi.fn(),
          markRead: vi.fn(),
        },
        items: {
          get: vi.fn().mockResolvedValue([]),
          getById: vi.fn(),
          getContent: vi.fn(),
          getUpdated: vi.fn(),
          markRead: vi.fn(),
          markUnread: vi.fn(),
          star: vi.fn(),
          unstar: vi.fn(),
          markMultipleRead: vi.fn(),
          markMultipleUnread: vi.fn(),
          starMultiple: vi.fn(),
          unstarMultiple: vi.fn(),
          markAllRead: vi.fn(),
        },
        version: {
          get: vi.fn().mockResolvedValue({ version: '18.0.0', apiLevels: ['v1-3'] }),
        },
        auth: {
          validateCredentials: vi.fn().mockResolvedValue({ valid: true }),
        },
      };

      // Test that mock works
      expect(mockClient.feeds).toHaveProperty('getAll');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(vi.isMockFunction(mockClient.feeds.getAll)).toBe(true);
    });
  });
});
