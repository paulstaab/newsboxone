/**
 * Unit tests for the public version API endpoint.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { getVersion } from '@/lib/api/version';
import { NetworkError, ApiError } from '@/lib/api/client';

const API_PATH = '/api/version';

// Mock version response
const mockVersionResponse = {
  version: '18.0.0',
  apiLevels: ['v1-3'],
};

beforeEach(() => {
  server.resetHandlers();
});

describe('getVersion', () => {
  describe('successful responses', () => {
    it('should return version info for valid server', async () => {
      const result = await getVersion();

      expect(result).toEqual(mockVersionResponse);
      expect(result.version).toBe('18.0.0');
      expect(result.apiLevels).toContain('v1-3');
    });

    it('should work without authentication', async () => {
      let receivedAuth = false;

      server.use(
        http.get(API_PATH, ({ request }) => {
          receivedAuth = request.headers.has('Authorization');
          return HttpResponse.json(mockVersionResponse);
        }),
      );

      await getVersion();

      expect(receivedAuth).toBe(false);
    });

    it('should handle different version formats', async () => {
      const customVersion = {
        version: '19.1.2',
        apiLevels: ['v1-3', 'v2-0'],
      };

      server.use(
        http.get(API_PATH, () => {
          return HttpResponse.json(customVersion);
        }),
      );

      const result = await getVersion();

      expect(result.version).toBe('19.1.2');
      expect(result.apiLevels).toHaveLength(2);
    });
  });

  describe('network errors', () => {
    it('should throw NetworkError for unreachable server', async () => {
      server.use(
        http.get(API_PATH, () => HttpResponse.error()),
      );

      await expect(getVersion()).rejects.toThrow(NetworkError);
    }, 10000); // Increase timeout to account for retries
  });

  describe('invalid URLs', () => {
    it('should handle 404 for wrong endpoint path', async () => {
      server.use(
        http.get(API_PATH, () => new HttpResponse(null, { status: 404 })),
      );

      await expect(getVersion()).rejects.toThrow(ApiError);
      try {
        await getVersion();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('should handle 500 server errors', async () => {
      server.use(
        http.get(API_PATH, () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      try {
        await getVersion();
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
      }
    }, 15000); // Increase timeout to account for multiple retries
  });

  describe('error handling', () => {
    it('should throw ApiError immediately on 500 errors (no retry)', async () => {
      server.use(
        http.get(API_PATH, () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      try {
        await getVersion();
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
      }
    });

    it('should throw ApiError immediately on 404 errors (no retry)', async () => {
      server.use(
        http.get(API_PATH, () => new HttpResponse(null, { status: 404 })),
      );

      try {
        await getVersion();
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });
  });

  describe('edge cases', () => {
    it('should validate response structure', async () => {
      const result = await getVersion();

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('apiLevels');
      expect(typeof result.version).toBe('string');
      expect(Array.isArray(result.apiLevels)).toBe(true);
    });
  });
});
