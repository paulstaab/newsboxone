'use client';

import { useMemo, useRef, type RefObject } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import type { Article, ArticlePreview } from '@/types';
import { getArticle, getArticleContent } from '@/lib/api/items';

interface ArticlePopoutProps {
  isOpen: boolean;
  article: ArticlePreview | null;
  onClose: () => void;
  dialogRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Renders the expanded article popout dialog.
 */
export function ArticlePopout({
  isOpen,
  article,
  onClose,
  dialogRef,
  closeButtonRef,
}: ArticlePopoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldFetch = isOpen && Boolean(article);

  const { data: fullArticle, error: articleError } = useSWR<Article | null, Error>(
    shouldFetch && article ? ['article', article.id, article.feedId] : null,
    async () => (article ? getArticle(article.id) : null),
    {
      keepPreviousData: false,
    },
  );

  const {
    data: fullContent,
    error: contentError,
    isLoading: isContentLoading,
  } = useSWR<string | null, Error>(
    shouldFetch && article ? ['article-content', article.id] : null,
    async () => (article ? getArticleContent(article.id) : null),
    {
      keepPreviousData: false,
    },
  );

  const content = useMemo(() => {
    if (!article) return null;
    const trimmedTitle = article.title.trim();
    const trimmedFeedName = article.feedName.trim();
    return {
      title: trimmedTitle.length > 0 ? article.title : 'Untitled article',
      feedName: trimmedFeedName.length > 0 ? trimmedFeedName : 'Unknown source',
      author: article.author.trim(),
      summary: article.summary.trim(),
      publishedDate: article.pubDate ? new Date(article.pubDate * 1000) : null,
    };
  }, [article]);

  if (!isOpen || !article || !content) {
    return null;
  }

  const ageLabel = content.publishedDate
    ? formatDistanceToNow(content.publishedDate, { addSuffix: true }).replace(/^about\s+/i, '')
    : null;

  const normalizedContent = typeof fullContent === 'string' ? fullContent.trim() : '';
  const fallbackBody = fullArticle?.body ?? '';
  const bodyHtml = normalizedContent ? fullContent : fallbackBody;
  const bodyFallback = !bodyHtml && content.summary ? content.summary : null;
  const isBodyLoading = isContentLoading && !bodyHtml && !bodyFallback;
  const combinedError = contentError ?? articleError;
  const hasError = combinedError && !bodyHtml && !bodyFallback;

  return (
    <div
      className="article-popout__overlay"
      role="presentation"
      data-testid="article-popout-overlay"
    >
      <div
        className="article-popout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-popout-title"
        aria-describedby="article-popout-subheading"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          className="article-popout__close"
          onClick={onClose}
          aria-label="Close article"
          ref={closeButtonRef}
        >
          ×
        </button>
        <div className="article-popout__scroll" ref={scrollRef}>
          <div className="article-popout__heading">
            <h2 id="article-popout-title" className="article-popout__title">
              {content.title}
            </h2>
            <p id="article-popout-subheading" className="article-popout__subheading">
              {content.feedName}
              {content.author ? ` · ${content.author}` : ''}
              {ageLabel ? ` · ${ageLabel}` : ''}
            </p>
          </div>

          <div className="article-popout__body" dir={fullArticle?.rtl ? 'rtl' : 'ltr'}>
            {isBodyLoading ? (
              <div className="article-popout__loading">
                <div className="article-popout__spinner" />
                Loading full article...
              </div>
            ) : hasError ? (
              <div className="article-popout__error">
                Failed to load article content. Please try again.
              </div>
            ) : bodyHtml ? (
              <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : bodyFallback ? (
              <p>{bodyFallback}</p>
            ) : (
              <p>No additional article content available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
