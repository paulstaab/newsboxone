'use client';

import { useState } from 'react';
import type { ArticlePreview } from '@/types';
import { ArticleCard } from './ArticleCard';
import { MarkAllReadButton } from './MarkAllReadButton';
import { TimelineActionButton } from './TimelineActionButton';
import { timelineActionConfig } from './timelineActionConfig';

interface TimelineListProps {
  items: ArticlePreview[];
  isLoading?: boolean;
  emptyMessage?: string;
  onOpenArticle?: (article: ArticlePreview, opener: HTMLElement) => void;
  registerArticle?: (id: number) => (node: HTMLElement | null) => void;
  selectedArticleId?: number | null;
  onMarkAllRead?: () => Promise<void>;
  onSkipFolder?: () => Promise<void>;
  isUpdating?: boolean;
  disableActions?: boolean;
}

/**
 * Renders the list of timeline article cards.
 */
export function TimelineList({
  items,
  isLoading,
  emptyMessage,
  onOpenArticle,
  registerArticle,
  selectedArticleId,
  onMarkAllRead,
  onSkipFolder,
  isUpdating,
  disableActions,
}: TimelineListProps) {
  const [isSkipping, setIsSkipping] = useState(false);

  const showActions = items.length > 0 && Boolean(onMarkAllRead ?? onSkipFolder);
  const skipConfig = timelineActionConfig.skip;

  const handleSkip = async () => {
    if (!onSkipFolder || disableActions || isUpdating) return;

    setIsSkipping(true);
    try {
      await onSkipFolder();
    } catch (error) {
      console.error('Failed to skip folder:', error);
    } finally {
      setIsSkipping(false);
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="inline-flex items-center gap-3 text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading articles...</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">
        {emptyMessage ?? 'No unread articles in this folder.'}
      </div>
    );
  }

  const actionDisabled = disableActions ?? isUpdating;

  const renderActionRow = () => (
    <div className="timeline-list__actions">
      {onSkipFolder && (
        <TimelineActionButton
          icon={<skipConfig.Icon className="h-5 w-5" />}
          label={skipConfig.label}
          tooltip={skipConfig.tooltip}
          disabled={actionDisabled ?? isSkipping}
          isLoading={isSkipping}
          onClick={() => {
            void handleSkip();
          }}
        />
      )}
      {onMarkAllRead && (
        <MarkAllReadButton
          onMarkAllRead={onMarkAllRead}
          disabled={actionDisabled}
          className="border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50"
        />
      )}
    </div>
  );

  return (
    <div className="timeline-list">
      {showActions && renderActionRow()}
      <div className="timeline-list__items" role="listbox" aria-label="Timeline articles">
        {items.map((article) => (
          <ArticleCard
            key={`${String(article.id)}-${String(article.feedId)}`}
            article={article}
            onOpen={onOpenArticle}
            registerArticle={registerArticle}
            isSelected={article.id === selectedArticleId}
          />
        ))}
      </div>
      {showActions && renderActionRow()}
    </div>
  );
}
