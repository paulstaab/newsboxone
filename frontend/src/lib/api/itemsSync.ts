import { CONFIG } from '@/lib/config/env';
import { api } from './apiClient';
import { ItemFilterType, type Article, type ItemsQueryParams } from '@/types';

interface UnreadSyncResult {
  items: Article[];
  serverUnreadIds: Set<number>;
}

export async function fetchUnreadItemsForSync(
  params: ItemsQueryParams = {},
): Promise<UnreadSyncResult> {
  const resolvedBatchSize = Math.max(1, params.batchSize ?? CONFIG.DEFAULT_BATCH_SIZE);
  const type = params.type ?? ItemFilterType.ALL;
  const id = params.id ?? 0;
  const lastModified = params.lastModified;

  const items: Article[] = [];
  const serverUnreadIds = new Set<number>();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await api.items.get(
      {
        batchSize: resolvedBatchSize,
        offset,
        type,
        id,
        oldestFirst: false,
        lastModified,
        getRead: false,
      },
      { maxRetries: 1 },
    );

    for (const article of page) {
      items.push(article);
      serverUnreadIds.add(article.id);
    }

    const pageMinId = page.reduce<number | null>(
      (minId, article) => (minId === null ? article.id : Math.min(minId, article.id)),
      null,
    );

    if (page.length === resolvedBatchSize && pageMinId !== null && pageMinId > 1) {
      hasMore = true;
      offset = pageMinId - 1;
    } else {
      hasMore = false;
    }
  }

  return { items, serverUnreadIds };
}
