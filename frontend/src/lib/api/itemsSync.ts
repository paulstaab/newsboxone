import { CONFIG } from '@/lib/config/env';
import { getItems } from './items';
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
  const oldestFirst = params.oldestFirst ?? false;
  const lastModified = params.lastModified;

  const items: Article[] = [];
  const serverUnreadIds = new Set<number>();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await getItems(
      {
        batchSize: resolvedBatchSize,
        offset,
        type,
        id,
        oldestFirst,
        lastModified,
        getRead: false,
      },
      { maxRetries: 1 },
    );

    for (const article of page) {
      items.push(article);
      serverUnreadIds.add(article.id);
    }

    hasMore = page.length === resolvedBatchSize;
    if (hasMore) {
      offset += resolvedBatchSize;
    }
  }

  return { items, serverUnreadIds };
}
