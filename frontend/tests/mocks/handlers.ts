/**
 * MSW request handlers for the same-origin NewsBoxOne API.
 * Provides realistic mock data for testing.
 */

import { http, HttpResponse, type HttpHandler } from 'msw';

// Base URL for mock API in jsdom tests.
const BASE_URL = '/api';

const VALID_TOKEN = 'test-token';

/**
 * Helper to check authorization header.
 */
function isAuthorized(request: Request): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${VALID_TOKEN}`;
}

/**
 * Mock folder data (mirrors headless-rss API response shape).
 */
export const mockFolders = [
  { id: 10, name: 'Engineering Updates', feeds: [101, 102], parentId: null, opened: true },
  { id: 20, name: 'Design Inspiration', feeds: [201], parentId: null, opened: true },
  { id: 30, name: 'Podcasts', feeds: [301], parentId: null, opened: false },
];

/**
 * Mock feed data.
 */
export const mockFeeds = [
  {
    id: 101,
    url: 'https://frontend.example.com/rss',
    title: 'Frontend Focus',
    faviconLink: 'https://frontend.example.com/favicon.ico',
    added: 1702200000,
    nextUpdateTime: 1702203600,
    folderId: 10,
    ordering: 0,
    link: 'https://frontend.example.com',
    pinned: false,
    updateErrorCount: 0,
    lastUpdateError: null,
  },
  {
    id: 102,
    url: 'https://backend.example.com/rss',
    title: 'Backend Briefing',
    faviconLink: 'https://backend.example.com/favicon.ico',
    added: 1702105000,
    nextUpdateTime: 1702208600,
    folderId: 10,
    ordering: 1,
    link: 'https://backend.example.com',
    pinned: false,
    updateErrorCount: 0,
    lastUpdateError: null,
  },
  {
    id: 201,
    url: 'https://design.example.com/rss',
    title: 'Design Notes',
    faviconLink: null,
    added: 1702000000,
    nextUpdateTime: 1702203600,
    folderId: 20,
    ordering: 0,
    link: 'https://design.example.com',
    pinned: true,
    updateErrorCount: 0,
    lastUpdateError: null,
  },
  {
    id: 301,
    url: 'https://podcasts.example.com/rss',
    title: 'The Pod Stack',
    faviconLink: 'https://podcasts.example.com/icon.png',
    added: 1701900000,
    nextUpdateTime: 1702303600,
    folderId: 30,
    ordering: 0,
    link: 'https://podcasts.example.com',
    pinned: false,
    updateErrorCount: 1,
    lastUpdateError: 'Connection timeout',
  },
];

/**
 * Mock article/item data.
 */
export const mockItems = [
  {
    id: 1001,
    title: 'Ship It Saturday: Folder Queue',
    author: 'Platform Team',
    body: '<p>Engineering just shipped the folder queue feature.</p>',
    contentHash: 'eng-queue-1001',
    enclosureLink: null,
    enclosureMime: null,
    feedId: 101,
    folderId: 10,
    fingerprint: 'eng-queue-1001',
    guid: 'https://frontend.example.com/posts/folder-queue',
    guidHash: 'eng-queue',
    lastModified: 1702200000,
    mediaDescription: null,
    mediaThumbnail: 'https://frontend.example.com/thumbs/folder-queue.jpg',
    pubDate: 1702199000,
    rtl: false,
    starred: false,
    unread: true,
    updatedDate: null,
    url: 'https://frontend.example.com/posts/folder-queue',
  },
  {
    id: 1002,
    title: 'Accessibility Improvements Rolling Out',
    author: 'Accessibility Guild',
    body: '<p>New keyboard shortcuts now live.</p>',
    contentHash: 'eng-a11y-1002',
    enclosureLink: null,
    enclosureMime: null,
    feedId: 102,
    folderId: 10,
    fingerprint: 'eng-a11y-1002',
    guid: 'https://backend.example.com/posts/accessibility',
    guidHash: 'eng-a11y',
    lastModified: 1702195000,
    mediaDescription: null,
    mediaThumbnail: null,
    pubDate: 1702194000,
    rtl: false,
    starred: true,
    unread: true,
    updatedDate: null,
    url: 'https://backend.example.com/posts/accessibility',
  },
  {
    id: 1003,
    title: 'Observability Deep Dive',
    author: 'Infra Team',
    body: '<p>Tracing the folder queue pipeline end to end.</p>',
    contentHash: 'eng-obs-1003',
    enclosureLink: null,
    enclosureMime: null,
    feedId: 101,
    folderId: 10,
    fingerprint: 'eng-obs-1003',
    guid: 'https://frontend.example.com/posts/observability',
    guidHash: 'eng-obs',
    lastModified: 1702190000,
    mediaDescription: null,
    mediaThumbnail: 'https://frontend.example.com/thumbs/observability.jpg',
    pubDate: 1702189000,
    rtl: false,
    starred: false,
    unread: true,
    updatedDate: null,
    url: 'https://frontend.example.com/posts/observability',
  },
  {
    id: 2001,
    title: 'Color Systems for 2025',
    author: 'Design Systems',
    body: '<p>Exploring new gradient tokens.</p>',
    contentHash: 'design-color-2001',
    enclosureLink: null,
    enclosureMime: null,
    feedId: 201,
    folderId: 20,
    fingerprint: 'design-color-2001',
    guid: 'https://design.example.com/posts/colors-2025',
    guidHash: 'design-color',
    lastModified: 1702185000,
    mediaDescription: null,
    mediaThumbnail: 'https://design.example.com/thumbs/colors.jpg',
    pubDate: 1702184000,
    rtl: false,
    starred: false,
    unread: true,
    updatedDate: null,
    url: 'https://design.example.com/posts/colors-2025',
  },
  {
    id: 2002,
    title: 'Motion Studies: Folder Stepper',
    author: 'Motion Lab',
    body: '<p>Documenting the folder stepper animation curves.</p>',
    contentHash: 'design-motion-2002',
    enclosureLink: null,
    enclosureMime: null,
    feedId: 201,
    folderId: 20,
    fingerprint: 'design-motion-2002',
    guid: 'https://design.example.com/posts/motion-folder-stepper',
    guidHash: 'design-motion',
    lastModified: 1702180000,
    mediaDescription: null,
    mediaThumbnail: null,
    pubDate: 1702179000,
    rtl: false,
    starred: false,
    unread: true,
    updatedDate: null,
    url: 'https://design.example.com/posts/motion-folder-stepper',
  },
  {
    id: 3001,
    title: 'Pod Stack Episode 42',
    author: 'Hosts',
    body: '<p>Discussing offline-first UX wins.</p>',
    contentHash: 'pod-episode-42',
    enclosureLink: 'https://podcasts.example.com/audio/episode42.mp3',
    enclosureMime: 'audio/mpeg',
    feedId: 301,
    folderId: 30,
    fingerprint: 'pod-episode-42',
    guid: 'https://podcasts.example.com/episodes/42',
    guidHash: 'pod-ep-42',
    lastModified: 1702175000,
    mediaDescription: 'Offline-first discussion',
    mediaThumbnail: 'https://podcasts.example.com/thumbs/episode42.jpg',
    pubDate: 1702174000,
    rtl: false,
    starred: false,
    unread: true,
    updatedDate: null,
    url: 'https://podcasts.example.com/episodes/42',
  },
  {
    id: 3002,
    title: 'Previously Played: Offline Sync',
    author: 'Hosts',
    body: '<p>Follow-up from episode 41.</p>',
    contentHash: 'pod-episode-41',
    enclosureLink: 'https://podcasts.example.com/audio/episode41.mp3',
    enclosureMime: 'audio/mpeg',
    feedId: 301,
    folderId: 30,
    fingerprint: 'pod-episode-41',
    guid: 'https://podcasts.example.com/episodes/41',
    guidHash: 'pod-ep-41',
    lastModified: 1702160000,
    mediaDescription: 'Previously aired show',
    mediaThumbnail: null,
    pubDate: 1702159000,
    rtl: false,
    starred: true,
    unread: false,
    updatedDate: null,
    url: 'https://podcasts.example.com/episodes/41',
  },
];

/**
 * API version info.
 */
export const mockVersion = {
  version: '18.0.0',
  apiLevels: ['v1-3'],
};

/**
 * Request handlers for MSW.
 */
export const handlers: HttpHandler[] = [
  // Legacy health check endpoint
  http.get('https://example.com/health', () => HttpResponse.json({ ok: true })),

  http.post(`${BASE_URL}/auth/token`, async ({ request }) => {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      rememberDevice?: boolean;
    };

    if (body.username === 'testuser' && body.password === 'testpass') {
      return HttpResponse.json({
        token: VALID_TOKEN,
        expiresAt: body.rememberDevice ? '2026-04-30T00:00:00.000Z' : '2026-03-29T00:00:00.000Z',
      });
    }

    return HttpResponse.json({ detail: 'Invalid authentication credentials' }, { status: 401 });
  }),

  http.post(`${BASE_URL}/auth/logout`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // GET /version - public endpoint (no auth required)
  http.get(`${BASE_URL}/version`, () => {
    return HttpResponse.json(mockVersion);
  }),

  // GET /feeds - requires auth
  http.get(`${BASE_URL}/feeds`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({ feeds: mockFeeds });
  }),

  // POST /feeds - create feed
  http.post(`${BASE_URL}/feeds`, async ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    const body = (await request.json()) as { url: string; folderId: number | null };
    const newFeed = {
      id: Math.floor(Math.random() * 1000) + 100,
      url: body.url,
      title: 'New Feed',
      faviconLink: null,
      added: Math.floor(Date.now() / 1000),
      nextUpdateTime: null,
      folderId: body.folderId,
      ordering: 0,
      link: body.url,
      pinned: false,
      updateErrorCount: 0,
      lastUpdateError: null,
    };
    return HttpResponse.json({ feeds: [newFeed] });
  }),

  // DELETE /feeds/:feedId
  http.delete(`${BASE_URL}/feeds/:feedId`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /feeds/:feedId/move
  http.post(`${BASE_URL}/feeds/:feedId/move`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /feeds/:feedId/rename
  http.post(`${BASE_URL}/feeds/:feedId/rename`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /feeds/:feedId/read
  http.post(`${BASE_URL}/feeds/:feedId/read`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // GET /folders - requires auth
  http.get(`${BASE_URL}/folders`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({ folders: mockFolders });
  }),

  // POST /folders - create folder
  http.post(`${BASE_URL}/folders`, async ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    const body = (await request.json()) as { name: string };
    const newFolder = {
      id: Math.floor(Math.random() * 1000) + 100,
      name: body.name,
    };
    return HttpResponse.json({ folders: [newFolder] });
  }),

  // PUT /folders/:folderId
  http.put(`${BASE_URL}/folders/:folderId`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // DELETE /folders/:folderId
  http.delete(`${BASE_URL}/folders/:folderId`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /folders/:folderId/read
  http.post(`${BASE_URL}/folders/:folderId/read`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // GET /items - requires auth
  http.get(`${BASE_URL}/items`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }

    const url = new URL(request.url);
    const getRead = url.searchParams.get('getRead') !== 'false';
    const type = parseInt(url.searchParams.get('type') ?? '3', 10);
    const id = parseInt(url.searchParams.get('id') ?? '0', 10);

    let filteredItems = [...mockItems];

    // Filter by read status
    if (!getRead) {
      filteredItems = filteredItems.filter((item) => item.unread);
    }

    // Filter by type
    if (type === 0 && id > 0) {
      // Feed filter
      filteredItems = filteredItems.filter((item) => item.feedId === id);
    } else if (type === 1 && id > 0) {
      // Folder filter - get feeds in folder, then filter items
      const feedsInFolder = mockFeeds.filter((f) => f.folderId === id).map((f) => f.id);
      filteredItems = filteredItems.filter((item) => feedsInFolder.includes(item.feedId));
    } else if (type === 2) {
      // Starred only
      filteredItems = filteredItems.filter((item) => item.starred);
    }

    return HttpResponse.json({ items: filteredItems });
  }),

  // GET /items/:itemId/content
  http.get(`${BASE_URL}/items/:itemId/content`, ({ request, params }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }

    const itemId = Number(params.itemId);
    const item = mockItems.find((entry) => entry.id === itemId);

    if (!item?.body) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({ content: item.body });
  }),

  // GET /items/updated
  http.get(`${BASE_URL}/items/updated`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }

    const url = new URL(request.url);
    const lastModified = parseInt(url.searchParams.get('lastModified') ?? '0', 10);

    const updatedItems = mockItems.filter((item) => item.lastModified > lastModified);
    return HttpResponse.json({ items: updatedItems });
  }),

  // POST /items/:itemId/read
  http.post(`${BASE_URL}/items/:itemId/read`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/:itemId/unread
  http.post(`${BASE_URL}/items/:itemId/unread`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/:itemId/star
  http.post(`${BASE_URL}/items/:itemId/star`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/:itemId/unstar
  http.post(`${BASE_URL}/items/:itemId/unstar`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/read/multiple
  http.post(`${BASE_URL}/items/read/multiple`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/unread/multiple
  http.post(`${BASE_URL}/items/unread/multiple`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/star/multiple
  http.post(`${BASE_URL}/items/star/multiple`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/unstar/multiple
  http.post(`${BASE_URL}/items/unstar/multiple`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /items/read - mark all read
  http.post(`${BASE_URL}/items/read`, ({ request }) => {
    if (!isAuthorized(request)) {
      return new HttpResponse(null, { status: 401 });
    }
    return new HttpResponse(null, { status: 200 });
  }),
];
