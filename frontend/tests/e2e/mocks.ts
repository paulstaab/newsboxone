/**
 * Playwright route interception for mocking API calls in E2E tests.
 * Uses similar data structures as MSW handlers but via Playwright's route API.
 */

import { type Page, type Route } from '@playwright/test';
import type { ApiFeed } from '@/types';

const nowInSeconds = Math.floor(Date.now() / 1000);

// Mock data matching MSW handlers
export const mockFolders = [
  { id: 10, name: 'Engineering Updates', feeds: [101, 102] },
  { id: 20, name: 'Design Inspiration', feeds: [201] },
  { id: 30, name: 'Podcasts', feeds: [301] },
];

export const mockFeeds: ApiFeed[] = [
  {
    id: 101,
    url: 'https://frontend.example.com/rss',
    title: 'Frontend Focus',
    faviconLink: 'https://frontend.example.com/favicon.ico',
    added: 1702200000,
    nextUpdateTime: nowInSeconds + 1800,
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
    nextUpdateTime: nowInSeconds + 5400,
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
    nextUpdateTime: nowInSeconds + 7200,
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
    nextUpdateTime: nowInSeconds + 14400,
    folderId: 30,
    ordering: 0,
    link: 'https://podcasts.example.com',
    pinned: false,
    updateErrorCount: 1,
    lastUpdateError: 'Connection timeout',
  },
];

export function getMockItems() {
  return [
    {
      id: 1001,
      title: 'Ship It Saturday: Folder Queue',
      author: 'Platform Team',
      body: '<p>Engineering just shipped the folder queue feature.</p>',
      feedId: 101,
      folderId: 10,
      guid: 'https://frontend.example.com/posts/folder-queue',
      guidHash: 'hash1001',
      pubDate: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      lastModified: Math.floor(Date.now() / 1000) - 3600,
      starred: false,
      unread: true,
      url: 'https://frontend.example.com/posts/folder-queue',
      enclosureLink: null,
      enclosureMime: null,
      fingerprint: 'fp1001',
      contentHash: 'ch1001',
      mediaThumbnail: null,
      mediaDescription: null,
      rtl: false,
    },
    {
      id: 1002,
      title: 'Accessibility Improvements Rolling Out',
      author: 'Accessibility Guild',
      body: '<p>New keyboard shortcuts now live.</p>',
      feedId: 102,
      folderId: 10,
      guid: 'https://backend.example.com/posts/accessibility',
      guidHash: 'hash1002',
      pubDate: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      lastModified: Math.floor(Date.now() / 1000) - 7200,
      starred: false,
      unread: true,
      url: 'https://backend.example.com/posts/accessibility',
      enclosureLink: null,
      enclosureMime: null,
      fingerprint: 'fp1002',
      contentHash: 'ch1002',
      mediaThumbnail: null,
      mediaDescription: null,
      rtl: false,
    },
    {
      id: 1003,
      title: 'Observability Deep Dive',
      author: 'Infra Team',
      body: '<p>Tracing the folder queue pipeline end to end.</p>',
      feedId: 101,
      folderId: 10,
      guid: 'https://frontend.example.com/posts/observability',
      guidHash: 'hash1003',
      pubDate: Math.floor(Date.now() / 1000) - 10800, // 3 hours ago
      lastModified: Math.floor(Date.now() / 1000) - 10800,
      starred: false,
      unread: true,
      url: 'https://frontend.example.com/posts/observability',
      enclosureLink: null,
      enclosureMime: null,
      fingerprint: 'fp1003',
      contentHash: 'ch1003',
      mediaThumbnail: null,
      mediaDescription: null,
      rtl: false,
    },
    {
      id: 2001,
      title: 'Color Systems for 2025',
      author: 'Design Systems',
      body: '<p>Exploring new gradient tokens.</p>',
      feedId: 201,
      folderId: 20,
      guid: 'https://design.example.com/posts/colors-2025',
      guidHash: 'hash2001',
      pubDate: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
      lastModified: Math.floor(Date.now() / 1000) - 14400,
      starred: false,
      unread: true,
      url: 'https://design.example.com/posts/colors-2025',
      enclosureLink: null,
      enclosureMime: null,
      fingerprint: 'fp2001',
      contentHash: 'ch2001',
      mediaThumbnail: null,
      mediaDescription: null,
      rtl: false,
    },
    {
      id: 2002,
      title: 'Motion Studies: Folder Stepper',
      author: 'Motion Lab',
      body: '<p>Documenting the folder stepper animation curves.</p>',
      feedId: 201,
      folderId: 20,
      guid: 'https://design.example.com/posts/motion-folder-stepper',
      guidHash: 'hash2002',
      pubDate: Math.floor(Date.now() / 1000) - 18000, // 5 hours ago
      lastModified: Math.floor(Date.now() / 1000) - 18000,
      starred: false,
      unread: true,
      url: 'https://design.example.com/posts/motion-folder-stepper',
      enclosureLink: null,
      enclosureMime: null,
      fingerprint: 'fp2002',
      contentHash: 'ch2002',
      mediaThumbnail: null,
      mediaDescription: null,
      rtl: false,
    },
    {
      id: 3001,
      title: 'Pod Stack Episode 42',
      author: 'Hosts',
      body: '<p>Discussing offline-first UX wins.</p>',
      feedId: 301,
      folderId: 30,
      guid: 'https://podcasts.example.com/episodes/42',
      guidHash: 'hash3001',
      pubDate: Math.floor(Date.now() / 1000) - 21600, // 6 hours ago
      lastModified: Math.floor(Date.now() / 1000) - 21600,
      starred: false,
      unread: true,
      url: 'https://podcasts.example.com/episodes/42',
      enclosureLink: null,
      enclosureMime: null,
      fingerprint: 'fp3001',
      contentHash: 'ch3001',
      mediaThumbnail: null,
      mediaDescription: null,
      rtl: false,
    },
  ];
}

// Backward compatibility: export mockItems as the result of calling getMockItems()
export const mockItems = getMockItems();

/**
 * Set up API mocks for E2E tests using Playwright route interception.
 */
export async function setupApiMocks(page: Page, baseUrl = 'https://rss.example.com') {
  const apiPath = '/api';
  const apiBase = `${baseUrl}${apiPath}`;
  const feeds = mockFeeds.map((feed) => ({ ...feed }));
  const folders = mockFolders.map((folder) => ({ ...folder, feeds: [...folder.feeds] }));
  const items = getMockItems().map((item) => ({ ...item }));
  let nextFeedId = 1000;
  let nextFolderId = 100;

  const isAuthorized = (route: Route) =>
    route.request().headers().authorization === 'Basic dGVzdHVzZXI6dGVzdHBhc3M=';

  const syncFolderFeedAssignments = () => {
    for (const folder of folders) {
      folder.feeds = feeds.filter((feed) => feed.folderId === folder.id).map((feed) => feed.id);
    }
  };

  const fulfillUnauthorized = async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  };

  // Mock version endpoint (no auth required)
  await page.route(`${apiBase}/version`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.3.0' }),
    });
  });

  // Mock feeds endpoint and feed mutations
  await page.route(`${apiBase}/feeds**`, async (route: Route) => {
    if (!isAuthorized(route)) {
      await fulfillUnauthorized(route);
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname.endsWith('/feeds') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          feeds,
          starredCount: 1,
          newestItemId: 103,
        }),
      });
      return;
    }

    if (pathname.endsWith('/feeds') && method === 'POST') {
      const body = (await request.postDataJSON()) as { url: string; folderId: number | null };
      const hostname = new URL(body.url).hostname.replace(/^www\./, '');
      const newFeed = {
        id: nextFeedId++,
        url: body.url,
        title: hostname,
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

      feeds.push(newFeed);
      syncFolderFeedAssignments();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ feeds: [newFeed], newestItemId: null }),
      });
      return;
    }

    const feedMatch = /\/feeds\/(\d+)(?:\/(move|rename|read))?$/.exec(pathname);
    if (!feedMatch) {
      await route.fulfill({ status: 404 });
      return;
    }

    const feedId = Number(feedMatch[1]);
    const action = feedMatch[2];
    const feedIndex = feeds.findIndex((feed) => feed.id === feedId);

    if (feedIndex === -1) {
      await route.fulfill({ status: 404 });
      return;
    }

    if (method === 'DELETE' && pathname.endsWith(`/feeds/${String(feedId)}`)) {
      feeds.splice(feedIndex, 1);
      syncFolderFeedAssignments();
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (method === 'POST' && action === 'move') {
      const body = (await request.postDataJSON()) as { folderId: number | null };
      feeds[feedIndex].folderId = body.folderId;
      syncFolderFeedAssignments();
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (method === 'POST' && action === 'rename') {
      const body = (await request.postDataJSON()) as { feedTitle: string };
      feeds[feedIndex].title = body.feedTitle;
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (method === 'POST' && action === 'read') {
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    await route.fulfill({ status: 405 });
  });

  // Mock items endpoint
  // Per Core Principle VI (Unread-Only Focus), API MUST return only unread articles
  await page.route(`${apiBase}/items/*/content`, async (route: Route) => {
    if (!isAuthorized(route)) {
      await fulfillUnauthorized(route);
      return;
    }

    const url = new URL(route.request().url());
    const segments = url.pathname.split('/');
    const itemId = Number(segments[segments.length - 2]);
    const item = items.find((entry) => entry.id === itemId);

    if (!item?.body) {
      await route.fulfill({ status: 404 });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: item.body }),
    });
  });

  await page.route(`${apiBase}/items**`, async (route: Route) => {
    if (!isAuthorized(route)) {
      await fulfillUnauthorized(route);
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const getRead = url.searchParams.get('getRead') !== 'false';
    const type = Number(url.searchParams.get('type') ?? '3');
    const id = Number(url.searchParams.get('id') ?? '0');
    const batchSize = Number(url.searchParams.get('batchSize') ?? String(items.length));
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const oldestFirst = url.searchParams.get('oldestFirst') === 'true';

    let filteredItems = [...items];

    if (!getRead) {
      filteredItems = filteredItems.filter((item) => item.unread);
    }

    if (type === 0 && id > 0) {
      filteredItems = filteredItems.filter((item) => item.feedId === id);
    }

    if (type === 1 && id > 0) {
      filteredItems = filteredItems.filter((item) => item.folderId === id);
    }

    filteredItems.sort((left, right) =>
      oldestFirst ? left.pubDate - right.pubDate : right.pubDate - left.pubDate,
    );

    filteredItems = filteredItems.slice(offset, offset + batchSize);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: filteredItems }),
    });
  });

  // Mock folders endpoint and folder mutations
  await page.route(`${apiBase}/folders**`, async (route: Route) => {
    if (!isAuthorized(route)) {
      await fulfillUnauthorized(route);
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname.endsWith('/folders') && method === 'GET') {
      syncFolderFeedAssignments();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ folders }),
      });
      return;
    }

    if (pathname.endsWith('/folders') && method === 'POST') {
      const body = (await request.postDataJSON()) as { name: string };
      const newFolder = { id: nextFolderId++, name: body.name, feeds: [] as number[] };
      folders.push(newFolder);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ folders: [newFolder] }),
      });
      return;
    }

    const folderMatch = /\/folders\/(\d+)(?:\/(read))?$/.exec(pathname);
    if (!folderMatch) {
      await route.fulfill({ status: 404 });
      return;
    }

    const folderId = Number(folderMatch[1]);
    const action = folderMatch[2];
    const folderIndex = folders.findIndex((folder) => folder.id === folderId);

    if (folderIndex === -1) {
      await route.fulfill({ status: 404 });
      return;
    }

    if (method === 'PUT' && pathname.endsWith(`/folders/${String(folderId)}`)) {
      const body = (await request.postDataJSON()) as { name: string };
      folders[folderIndex].name = body.name;
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (method === 'DELETE' && pathname.endsWith(`/folders/${String(folderId)}`)) {
      folders.splice(folderIndex, 1);
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (method === 'POST' && action === 'read') {
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    await route.fulfill({ status: 405 });
  });
}

/**
 * Set up mock for unreachable server (network error).
 */
export async function setupUnreachableServer(page: Page, baseUrl = 'https://rss.example.com') {
  const apiPath = '/api';
  const apiBase = `${baseUrl}${apiPath}`;

  await page.route(`${apiBase}/**`, async (route: Route) => {
    await route.abort('failed');
  });
}

/**
 * Set up mock for invalid API path (404).
 */
export async function setupInvalidApiPath(page: Page, baseUrl = 'https://rss.example.com') {
  const apiPath = '/api';
  const apiBase = `${baseUrl}${apiPath}`;

  await page.route(`${apiBase}/**`, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: 'text/html',
      body: '<html><body>Not Found</body></html>',
    });
  });
}
