import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { getNextSelectionId, getPreviousSelectionId } from './selection';

const DEFAULT_EXCLUDE_SELECTORS = ['input', 'textarea', 'select', '[contenteditable="true"]'];

export interface TimelineKeydownOptions {
  timelineRef: RefObject<HTMLElement | null>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onActivate?: (id: number, element: HTMLElement | null) => void;
  onMarkRead?: (id: number) => void;
  excludeSelectors?: string[];
}

function isExcludedFocus(activeElement: Element | null, selectors: string[]): boolean {
  if (!activeElement) return false;
  return selectors.some((selector) => Boolean(activeElement.closest(selector)));
}

function getOrderedArticleElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-article-id]'));
}

function getTopmostVisibleId(container: HTMLElement): number | null {
  const elements = getOrderedArticleElements(container);
  const viewportHeight = window.innerHeight;
  let best: { id: number; top: number } | null = null;

  for (const element of elements) {
    const id = Number(element.dataset.articleId);
    if (!Number.isFinite(id)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= viewportHeight) continue;

    if (!best || rect.top < best.top) {
      best = { id, top: rect.top };
    }
  }

  return best?.id ?? null;
}

type AnyKeyboardEvent = KeyboardEvent | ReactKeyboardEvent<HTMLElement>;

export function handleTimelineKeyDown(
  event: AnyKeyboardEvent,
  {
    timelineRef,
    selectedId,
    onSelect,
    onActivate,
    onMarkRead,
    excludeSelectors = DEFAULT_EXCLUDE_SELECTORS,
  }: TimelineKeydownOptions,
): void {
  const container = timelineRef.current;
  if (!container) return;

  const activeElement = document.activeElement;
  const isBodyFocus =
    activeElement === null ||
    activeElement === document.body ||
    activeElement === document.documentElement;
  if (!isBodyFocus && !container.contains(activeElement)) return;
  if (isExcludedFocus(activeElement, excludeSelectors)) return;

  const key = event.key;
  const isArrow = key === 'ArrowDown' || key === 'ArrowUp';
  const isSpace = key === ' ' || key === 'Spacebar';
  if (!isArrow && !isSpace) return;

  const elements = getOrderedArticleElements(container);
  const orderedIds = elements
    .map((element) => Number(element.dataset.articleId))
    .filter((id) => Number.isFinite(id));

  event.preventDefault();

  if (isSpace) {
    const resolvedId = selectedId ?? getTopmostVisibleId(container);
    if (resolvedId === null || typeof resolvedId === 'undefined') return;
    const target =
      elements.find((element) => Number(element.dataset.articleId) === resolvedId) ?? null;
    onActivate?.(resolvedId, target);
    return;
  }

  const nextId = (() => {
    if (selectedId === null) {
      return getTopmostVisibleId(container);
    }

    if (key === 'ArrowDown') {
      return getNextSelectionId(selectedId, orderedIds);
    }

    return getPreviousSelectionId(selectedId, orderedIds);
  })();

  if (nextId === null || typeof nextId === 'undefined') return;

  if (selectedId !== null && selectedId !== nextId) {
    onMarkRead?.(selectedId);
  }

  onSelect(nextId);

  const target = elements.find((element) => Number(element.dataset.articleId) === nextId);
  target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
