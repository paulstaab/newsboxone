'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { faBookmark, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ArticlePreview } from '@/types';

interface ArticleCardProps {
  article: ArticlePreview;
  onOpen?: (article: ArticlePreview, opener: HTMLElement) => void;
  onSaveToKarakeep?: (article: ArticlePreview) => Promise<void>;
  registerArticle?: (id: number) => (node: HTMLElement | null) => void;
  isSelected?: boolean;
  isSavingToKarakeep?: boolean;
  isSavedToKarakeep?: boolean;
}

const LONG_PRESS_MS = 600;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/**
 * Displays an article preview card and optional Karakeep save controls.
 */
export function ArticleCard({
  article,
  onOpen,
  onSaveToKarakeep,
  registerArticle,
  isSelected = false,
  isSavingToKarakeep = false,
  isSavedToKarakeep = false,
}: ArticleCardProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef({ x: 0, y: 0 });
  const longPressScrollCancelRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const lastPointerWasTouchRef = useRef(false);
  const publishedDate = article.pubDate ? new Date(article.pubDate * 1000) : null;
  const author = article.author.trim();
  const feedName = article.feedName.trim() || 'Unknown source';
  const ageLabel = publishedDate
    ? formatDistanceToNow(publishedDate, { addSuffix: true }).replace(/^about\\s+/i, '')
    : null;
  const summary = article.summary.trim();
  const fallbackColors = ['#f6b4c0', '#f7d49b', '#bfe3c7', '#b6d7f2', '#c8c5f2', '#f2b9df'];
  const fallbackColor = fallbackColors[article.id % fallbackColors.length];

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressScrollCancelRef.current) {
      window.removeEventListener('scroll', longPressScrollCancelRef.current, true);
      longPressScrollCancelRef.current = null;
    }
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input')) {
      return;
    }
    onOpen?.(article, event.currentTarget);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input')) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen?.(article, event.currentTarget);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    lastPointerWasTouchRef.current = event.pointerType === 'touch';
    if (
      event.pointerType !== 'touch' ||
      !onSaveToKarakeep ||
      isSavingToKarakeep ||
      target.closest('a, button, input')
    ) {
      return;
    }

    cancelLongPress();
    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    const handleScrollCancel = () => {
      cancelLongPress();
    };
    longPressScrollCancelRef.current = handleScrollCancel;
    window.addEventListener('scroll', handleScrollCancel, { capture: true, once: true });
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      suppressClickRef.current = true;
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(30);
      }
      void onSaveToKarakeep(article);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!longPressTimerRef.current) return;
    const distance = Math.hypot(
      event.clientX - longPressStartRef.current.x,
      event.clientY - longPressStartRef.current.y,
    );
    if (distance > LONG_PRESS_MOVE_TOLERANCE_PX) {
      cancelLongPress();
    }
  };

  return (
    <div
      className={`article-card${article.unread ? ' article-card--unread' : ''}${
        isSelected ? ' article-card--selected' : ''
      }`}
      ref={registerArticle ? registerArticle(article.id) : undefined}
      data-article-id={article.id}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(event) => {
        if (lastPointerWasTouchRef.current && onSaveToKarakeep) {
          event.preventDefault();
        }
      }}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
      aria-label={`Article: ${article.title || 'Untitled article'}${
        author ? ` by ${author}` : ''
      } (${article.unread ? 'unread' : 'read'})`}
    >
      <div className="article-card__media">
        {article.thumbnailUrl ? (
          <Image
            src={article.thumbnailUrl}
            alt=""
            fill
            className="article-card__media-image"
            unoptimized
          />
        ) : (
          <div
            className="article-card__media-fallback"
            style={{ backgroundColor: fallbackColor }}
          />
        )}
      </div>

      <div className="article-card__body">
        <div className="article-card__heading">
          <div className="article-card__title-row">
            <h3 className="article-card__title">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="article-card__title-link"
                aria-label={`Open ${article.title || 'article'} in new tab`}
              >
                {article.title || 'Untitled article'}
              </a>
            </h3>
            {onSaveToKarakeep ? (
              <button
                type="button"
                className={`article-card__karakeep-button${
                  isSavedToKarakeep ? ' article-card__karakeep-button--saved' : ''
                }`}
                disabled={isSavingToKarakeep}
                title={isSavedToKarakeep ? 'Remove from Karakeep' : 'Save to Karakeep'}
                aria-pressed={isSavedToKarakeep}
                aria-label={
                  isSavingToKarakeep
                    ? `Saving ${article.title || 'article'} to Karakeep`
                    : isSavedToKarakeep
                      ? `Remove ${article.title || 'article'} from Karakeep`
                      : `Save ${article.title || 'article'} to Karakeep`
                }
                onClick={(event) => {
                  event.stopPropagation();
                  void onSaveToKarakeep(article);
                }}
              >
                <FontAwesomeIcon icon={faBookmark} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="article-card__meta">
            <span className="article-card__source">
              {article.feedType === 'mailingList' && (
                <FontAwesomeIcon
                  icon={faEnvelope}
                  className="article-card__source-icon"
                  aria-label="Mailing list"
                />
              )}
              {feedName}
              {author ? ` - ${author}` : ''}
            </span>
            {ageLabel && publishedDate && (
              <>
                <span aria-hidden="true"> - </span>
                <time dateTime={publishedDate.toISOString()}>{ageLabel}</time>
              </>
            )}
          </div>
        </div>

        {summary && (
          <p className="article-card__excerpt article-card__excerpt--clamped">{summary}</p>
        )}
      </div>
    </div>
  );
}
