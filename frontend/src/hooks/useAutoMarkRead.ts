'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ArticlePreview } from '@/types';
import { createReadBatcher } from '@/lib/timeline/read-batching';

interface UseAutoMarkReadOptions {
  activeArticles: ArticlePreview[];
  markItemRead: (itemId: number) => Promise<void>;
  root?: Element | null;
  topOffset?: number;
  debounceMs?: number;
}

const OBSERVER_RE_ENABLE_DELAY_MS = 500;

/**
 * Observes article cards leaving the viewport and batches read-state updates.
 */
export function useAutoMarkRead({
  activeArticles,
  markItemRead,
  root,
  topOffset = 0,
  debounceMs = 100,
}: UseAutoMarkReadOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<number, HTMLElement>>(new Map());
  const seenRef = useRef<Set<number>>(new Set());
  const batcherRef = useRef<ReturnType<typeof createReadBatcher> | null>(null);
  const unreadMapRef = useRef<Map<number, boolean>>(new Map());
  const observerDisabledRef = useRef(false);
  const observerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    batcherRef.current?.clear();
    batcherRef.current = createReadBatcher({
      debounceMs,
      onFlush: (ids) => {
        ids.forEach((id) => {
          void markItemRead(id);
        });
      },
    });

    return () => {
      batcherRef.current?.clear();
      batcherRef.current = null;
      if (observerTimeoutRef.current !== null) {
        clearTimeout(observerTimeoutRef.current);
        observerTimeoutRef.current = null;
      }
    };
  }, [debounceMs, markItemRead]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (observerDisabledRef.current) return;

        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          const id = Number(target.dataset.articleId);
          if (!Number.isFinite(id)) return;

          if (!entry.isIntersecting && entry.boundingClientRect.bottom <= 0) {
            if (seenRef.current.has(id)) return;
            if (unreadMapRef.current.get(id) === false) return;
            seenRef.current.add(id);
            batcherRef.current?.add(id);
          }
        });
      },
      {
        root: root ?? null,
        rootMargin: `${String(-Math.max(0, Math.round(topOffset)))}px 0px 0px 0px`,
        threshold: [0],
      },
    );

    observerRef.current = observer;
    elementsRef.current.forEach((node) => {
      observer.observe(node);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [root, topOffset]);

  useEffect(() => {
    unreadMapRef.current = new Map(activeArticles.map((item) => [item.id, item.unread]));
    const currentIds = new Set(activeArticles.map((item) => item.id));
    for (const [id, element] of elementsRef.current.entries()) {
      if (!currentIds.has(id)) {
        observerRef.current?.unobserve(element);
        elementsRef.current.delete(id);
        seenRef.current.delete(id);
      }
    }
  }, [activeArticles]);

  const registerArticle = useCallback(
    (id: number) => (node: HTMLElement | null) => {
      if (!node) {
        const prev = elementsRef.current.get(id);
        if (prev) {
          observerRef.current?.unobserve(prev);
          elementsRef.current.delete(id);
        }
        return;
      }
      node.dataset.articleId = String(id);
      elementsRef.current.set(id, node);
      observerRef.current?.observe(node);
    },
    [],
  );

  const disableObserverTemporarily = useCallback(() => {
    observerDisabledRef.current = true;
    if (observerTimeoutRef.current !== null) {
      clearTimeout(observerTimeoutRef.current);
    }
    observerTimeoutRef.current = setTimeout(() => {
      observerDisabledRef.current = false;
      observerTimeoutRef.current = null;
    }, OBSERVER_RE_ENABLE_DELAY_MS);
  }, []);

  return {
    registerArticle,
    disableObserverTemporarily,
  };
}
