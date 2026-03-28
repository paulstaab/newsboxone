import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useItems } from '@/hooks/useItems';
import { getItems } from '@/lib/api/items';
import { UNCATEGORIZED_FOLDER_ID } from '@/types';
import type { UserSessionConfig } from '@/types';

interface MockAuthReturn {
  isAuthenticated: boolean;
  isInitializing: boolean;
  session: UserSessionConfig | null;
}

let mockAuthReturn: MockAuthReturn = {
  isAuthenticated: true,
  isInitializing: false,
  session: {
    username: 'user',
    token: 'test-token',
    expiresAt: '2026-04-01T00:00:00.000Z',
    rememberDevice: false,
    viewMode: 'card',
    sortOrder: 'newest',
    showRead: false,
    lastSyncAt: null,
  },
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: (): MockAuthReturn => mockAuthReturn,
}));

vi.mock('@/lib/api/items', () => ({
  getItems: vi.fn(),
}));

const mockedGetItems = vi.mocked(getItems);

beforeEach(() => {
  mockAuthReturn = {
    isAuthenticated: true,
    isInitializing: false,
    session: {
      username: 'user',
      token: 'test-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: false,
      viewMode: 'card',
      sortOrder: 'newest',
      showRead: false,
      lastSyncAt: null,
    },
  };
  mockedGetItems.mockClear();
});

describe('useItems', () => {
  it('filters items by activeFolderId while preserving allItems', async () => {
    mockAuthReturn = {
      isAuthenticated: true,
      isInitializing: false,
      session: {
        username: 'user1',
        token: 'test-token-1',
        expiresAt: '2026-04-01T00:00:00.000Z',
        rememberDevice: false,
        viewMode: 'card',
        sortOrder: 'newest',
        showRead: false,
        lastSyncAt: null,
      },
    };

    mockedGetItems.mockResolvedValueOnce([
      {
        id: 1,
        guid: 'guid-1',
        guidHash: 'hash-1',
        title: 'First',
        author: 'Author',
        url: 'https://example.com/1',
        body: 'Body',
        feedId: 101,
        folderId: 10,
        unread: true,
        starred: false,
        pubDate: 1_700_000_000,
        lastModified: 1_700_000_000,
        enclosureLink: null,
        enclosureMime: null,
        fingerprint: 'fp-1',
        contentHash: 'ch-1',
        mediaThumbnail: null,
        mediaDescription: null,
        rtl: false,
      },
      {
        id: 2,
        guid: 'guid-2',
        guidHash: 'hash-2',
        title: 'Second',
        author: 'Author',
        url: 'https://example.com/2',
        body: 'Body',
        feedId: 201,
        folderId: 20,
        unread: true,
        starred: false,
        pubDate: 1_700_000_000,
        lastModified: 1_700_000_000,
        enclosureLink: null,
        enclosureMime: null,
        fingerprint: 'fp-2',
        contentHash: 'ch-2',
        mediaThumbnail: null,
        mediaDescription: null,
        rtl: false,
      },
    ]);

    const { result } = renderHook(() => useItems({ activeFolderId: 10 }));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.items[0]?.id).toBe(1);
    expect(result.current.allItems).toHaveLength(2);
  });

  it('treats null folderId as UNCATEGORIZED_FOLDER_ID', async () => {
    mockAuthReturn = {
      isAuthenticated: true,
      isInitializing: false,
      session: {
        username: 'user2',
        token: 'test-token-2',
        expiresAt: '2026-04-01T00:00:00.000Z',
        rememberDevice: false,
        viewMode: 'card',
        sortOrder: 'newest',
        showRead: false,
        lastSyncAt: null,
      },
    };

    mockedGetItems.mockResolvedValueOnce([
      {
        id: 1,
        guid: 'guid-1',
        guidHash: 'hash-1',
        title: 'Uncategorized Item',
        author: 'Author',
        url: 'https://example.com/1',
        body: 'Body',
        feedId: 101,
        folderId: null,
        unread: true,
        starred: false,
        pubDate: 1_700_000_000,
        lastModified: 1_700_000_000,
        enclosureLink: null,
        enclosureMime: null,
        fingerprint: 'fp-1',
        contentHash: 'ch-1',
        mediaThumbnail: null,
        mediaDescription: null,
        rtl: false,
      },
      {
        id: 2,
        guid: 'guid-2',
        guidHash: 'hash-2',
        title: 'Categorized Item',
        author: 'Author',
        url: 'https://example.com/2',
        body: 'Body',
        feedId: 201,
        folderId: 20,
        unread: true,
        starred: false,
        pubDate: 1_700_000_000,
        lastModified: 1_700_000_000,
        enclosureLink: null,
        enclosureMime: null,
        fingerprint: 'fp-2',
        contentHash: 'ch-2',
        mediaThumbnail: null,
        mediaDescription: null,
        rtl: false,
      },
    ]);

    const { result } = renderHook(() => useItems({ activeFolderId: UNCATEGORIZED_FOLDER_ID }));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.items[0]?.id).toBe(1);
    expect(result.current.items[0]?.title).toBe('Uncategorized Item');
    expect(result.current.allItems).toHaveLength(2);
  });
});
