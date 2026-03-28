import type {
  Article,
  ArticlePreview,
  Folder,
  FolderQueueEntry,
  TimelineCacheEnvelope,
} from '@/types';
import { UNCATEGORIZED_FOLDER_ID } from '@/types';

function stripHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(body: string, fallback: string): string {
  const text = stripHtml(body);
  if (!text) return fallback;
  return text.length > 320 ? `${text.slice(0, 319).trim()}…` : text;
}

/**
 * Resolves the folder ID for a server article using either direct article data or feed metadata.
 */
export function resolveFolderId(
  article: Article,
  feedFolderMap: Map<number, number>,
): number | null {
  if (typeof article.folderId === 'number' && Number.isFinite(article.folderId)) {
    return article.folderId;
  }

  if (feedFolderMap.has(article.feedId)) {
    return feedFolderMap.get(article.feedId) ?? UNCATEGORIZED_FOLDER_ID;
  }

  return null;
}

/**
 * Normalizes a full article payload into the cached preview shape used by the timeline.
 */
export function toArticlePreview(
  article: Article,
  folderId: number | null,
  cachedAt: number,
  feedName: string,
): ArticlePreview | null {
  if (folderId === null) {
    return null;
  }

  const trimmedTitle = article.title.trim();
  const trimmedBody = article.body.trim();
  const trimmedUrl = article.url.trim();
  const trimmedAuthor = article.author.trim();
  const normalizedFeedName = feedName.trim();

  return {
    id: article.id,
    folderId,
    feedId: article.feedId,
    title: trimmedTitle.length > 0 ? trimmedTitle : 'Untitled article',
    feedName: normalizedFeedName.length > 0 ? normalizedFeedName : 'Unknown source',
    author: trimmedAuthor,
    summary: summarize(article.body, ''),
    body: trimmedBody,
    url: trimmedUrl.length > 0 ? trimmedUrl : '#',
    thumbnailUrl: article.mediaThumbnail,
    pubDate: article.pubDate,
    unread: article.unread,
    starred: article.starred,
    hasFullText: trimmedBody.length > 0,
    storedAt: cachedAt,
  };
}

/**
 * Reconciles cached folder names with the latest folder metadata.
 */
export function applyFolderNames(
  envelope: TimelineCacheEnvelope,
  foldersData: Folder[] | undefined,
): TimelineCacheEnvelope {
  if (!foldersData || foldersData.length === 0) {
    return envelope;
  }

  const folderNameMap = new Map<number, string>(
    foldersData.map((folder) => [folder.id, folder.name]),
  );
  const updatedFolders: Record<number, FolderQueueEntry> = {};

  for (const [folderIdStr, folder] of Object.entries(envelope.folders)) {
    const id = Number(folderIdStr);
    const resolvedName =
      folderNameMap.get(id) ?? (id === UNCATEGORIZED_FOLDER_ID ? 'Uncategorized' : folder.name);
    updatedFolders[id] = {
      ...folder,
      name: resolvedName,
    };
  }

  return {
    ...envelope,
    folders: updatedFolders,
  };
}

/**
 * Reconciles cached feed names with the latest feed metadata.
 */
export function applyFeedNames(
  envelope: TimelineCacheEnvelope,
  feedNameMap: Map<number, string>,
): TimelineCacheEnvelope {
  if (feedNameMap.size === 0) {
    return envelope;
  }

  const updatedFolders: Record<number, FolderQueueEntry> = {};

  for (const [folderIdStr, folder] of Object.entries(envelope.folders)) {
    updatedFolders[Number(folderIdStr)] = {
      ...folder,
      articles: folder.articles.map((article) => {
        const resolvedName = feedNameMap.get(article.feedId) ?? article.feedName;
        return resolvedName !== article.feedName ? { ...article, feedName: resolvedName } : article;
      }),
    };
  }

  return {
    ...envelope,
    folders: updatedFolders,
  };
}
