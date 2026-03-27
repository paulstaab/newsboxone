'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ArticlePreview, SelectionActions } from '@/types';
import {
  getNextSelectionId,
  getPreviousSelectionId,
  getTopmostVisibleId,
} from '@/lib/timeline/selection';

export interface TimelineSelectionState extends SelectionActions {
  selectedArticleId: number | null;
  setSelectedArticleId: (id: number | null) => void;
  selectedArticleElement: HTMLElement | null;
  setSelectedArticleElement: (element: HTMLElement | null) => void;
}

/**
 * Owns keyboard/focus selection state for the active timeline folder.
 */
export function useTimelineSelection(activeArticles: ArticlePreview[]): TimelineSelectionState {
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [selectedArticleElement, setSelectedArticleElement] = useState<HTMLElement | null>(null);

  const orderedIds = useMemo(() => activeArticles.map((article) => article.id), [activeArticles]);

  const selectTopmost = useCallback(
    (topmostId?: number | null) => {
      const resolvedId = topmostId ?? getTopmostVisibleId(orderedIds);
      if (resolvedId === null || typeof resolvedId === 'undefined') return;
      setSelectedArticleId(resolvedId);
    },
    [orderedIds],
  );

  const selectNext = useCallback(() => {
    const nextId = getNextSelectionId(selectedArticleId, orderedIds);
    if (nextId === null) return;
    setSelectedArticleId(nextId);
  }, [orderedIds, selectedArticleId]);

  const selectPrevious = useCallback(() => {
    const previousId = getPreviousSelectionId(selectedArticleId, orderedIds);
    if (previousId === null) return;
    setSelectedArticleId(previousId);
  }, [orderedIds, selectedArticleId]);

  const deselect = useCallback(() => {
    setSelectedArticleId(null);
    setSelectedArticleElement(null);
  }, []);

  return {
    selectedArticleId,
    setSelectedArticleId,
    selectedArticleElement,
    setSelectedArticleElement,
    selectTopmost,
    selectNext,
    selectPrevious,
    deselect,
  };
}
