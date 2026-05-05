'use client';

import { useCallback, useState } from 'react';
import type { Feed } from '@/types';

export type FeedQualityPreference = 'automatic' | 'enabled' | 'disabled';

/**
 * Converts stored tri-state quality override values into form values.
 */
export function boolToQualityPreference(value: boolean | null): FeedQualityPreference {
  if (value === null) {
    return 'automatic';
  }

  return value ? 'enabled' : 'disabled';
}

/**
 * Converts form values into API tri-state quality override values.
 */
export function qualityPreferenceToBool(value: FeedQualityPreference): boolean | null {
  if (value === 'automatic') {
    return null;
  }

  return value === 'enabled';
}

/**
 * Owns the feed-quality dialog form state.
 */
export function useFeedQualityForm() {
  const [qualityFeedId, setQualityFeedId] = useState<number | null>(null);
  const [qualityFeedTitle, setQualityFeedTitle] = useState('');
  const [qualityFeedFolderId, setQualityFeedFolderId] = useState('');
  const [qualityUseExtractedFulltext, setQualityUseExtractedFulltext] =
    useState<FeedQualityPreference>('automatic');
  const [qualityUseLlmSummary, setQualityUseLlmSummary] =
    useState<FeedQualityPreference>('automatic');

  const loadQualityForm = useCallback((feed: Feed) => {
    setQualityFeedId(feed.id);
    setQualityFeedTitle(feed.title);
    setQualityFeedFolderId(feed.folderId === null ? '' : String(feed.folderId));
    setQualityUseExtractedFulltext(boolToQualityPreference(feed.manualUseExtractedFulltext));
    setQualityUseLlmSummary(boolToQualityPreference(feed.manualUseLlmSummary));
  }, []);

  const resetQualityDialog = useCallback(() => {
    setQualityFeedId(null);
    setQualityFeedTitle('');
    setQualityFeedFolderId('');
    setQualityUseExtractedFulltext('automatic');
    setQualityUseLlmSummary('automatic');
  }, []);

  return {
    qualityFeedId,
    qualityFeedTitle,
    qualityFeedFolderId,
    qualityUseExtractedFulltext,
    qualityUseLlmSummary,
    setQualityFeedTitle,
    setQualityFeedFolderId,
    setQualityUseExtractedFulltext,
    setQualityUseLlmSummary,
    loadQualityForm,
    resetQualityDialog,
  };
}
