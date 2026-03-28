'use client';

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import type { ArticlePreview } from '@/types';

interface ArticleCardProps {
  article: ArticlePreview;
  onOpen?: (article: ArticlePreview, opener: HTMLElement) => void;
  registerArticle?: (id: number) => (node: HTMLElement | null) => void;
  isSelected?: boolean;
}

/**
 * Displays an article preview card in the timeline.
 */
export function ArticleCard({
  article,
  onOpen,
  registerArticle,
  isSelected = false,
}: ArticleCardProps) {
  const publishedDate = article.pubDate ? new Date(article.pubDate * 1000) : null;
  const author = article.author.trim();
  const feedName = article.feedName.trim() || 'Unknown source';
  const ageLabel = publishedDate
    ? formatDistanceToNow(publishedDate, { addSuffix: true }).replace(/^about\\s+/i, '')
    : null;
  const summary = article.summary.trim();
  const fallbackColors = ['#f6b4c0', '#f7d49b', '#bfe3c7', '#b6d7f2', '#c8c5f2', '#f2b9df'];
  const fallbackColor = fallbackColors[article.id % fallbackColors.length];

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('a')) {
      return;
    }
    onOpen?.(article, event.currentTarget as HTMLElement);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a')) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.(article, e.currentTarget as HTMLElement);
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
            alt="" // Decorative image, title describes content
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
          <div className="article-card__meta">
            <span>
              {feedName}
              {author ? ` · ${author}` : ''}
            </span>
            {ageLabel && publishedDate && (
              <>
                <span aria-hidden="true"> · </span>
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
