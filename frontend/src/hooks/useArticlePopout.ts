import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
const EXCLUDED_SELECTORS = ['input', 'textarea', 'select', '[contenteditable="true"]'];

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'),
  );
}

function isExcludedTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  return EXCLUDED_SELECTORS.some((selector) => Boolean(target.closest(selector)));
}

export interface ArticlePopoutKey {
  id: number;
  feedId: number;
}

export interface UseArticlePopoutResult {
  isOpen: boolean;
  articleKey: ArticlePopoutKey | null;
  dialogRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  openPopout: (articleKey: ArticlePopoutKey, opener?: HTMLElement | null) => void;
  closePopout: () => void;
}

/**
 * Controls the article popout dialog state and focus management.
 */
export function useArticlePopout(): UseArticlePopoutResult {
  const [articleKey, setArticleKey] = useState<ArticlePopoutKey | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const isOpen = articleKey !== null;

  const openPopout = useCallback(
    (nextArticleKey: ArticlePopoutKey, opener?: HTMLElement | null) => {
      openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
      setArticleKey(nextArticleKey);
    },
    [],
  );

  const closePopout = useCallback(() => {
    setArticleKey(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${String(scrollbarWidth)}px`;
    }

    const focusTarget = closeButtonRef.current ?? dialogRef.current;
    if (focusTarget) {
      window.setTimeout(() => {
        focusTarget.focus();
      }, 0);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (isExcludedTarget(activeElement)) return;

      if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Space') {
        event.preventDefault();
        closePopout();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !dialogRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen, closePopout]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      openerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  return {
    isOpen,
    articleKey,
    dialogRef,
    closeButtonRef,
    openPopout,
    closePopout,
  };
}
