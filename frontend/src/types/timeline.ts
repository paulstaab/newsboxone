import type { RefObject } from 'react';
import type { Article } from './article';

export interface TimelineViewportState {
  selectedArticleId: number | null;
  isDocked: boolean;
  dockedQueueHeight: number;
  topMostVisibleArticleId: number | null;
  localReadIds: Set<number>;
  pendingReadIds: Set<number>;
}

export interface ArticleWithSessionState extends Article {
  isSelected: boolean;
  isLocallyRead: boolean;
  isPendingRead: boolean;
}

export interface FolderQueueDockingState {
  isDocked: boolean;
  height: number;
  isResizing: boolean;
}

export interface SelectionNavigationState {
  selectedId: number | null;
  visibleArticleIds: number[];
  hasKeyboardSelection: boolean;
}

export interface SelectionActions {
  selectTopmost: (topmostId?: number | null) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  deselect: () => void;
}

export interface LocalReadState {
  localReads: Map<number, { markedAt: number }>;
  pendingReads: Set<number>;
  toEvict: number[];
}

export interface KeyboardContext {
  timelineRef: RefObject<HTMLElement>;
  isTimelineFocused: boolean;
  excludeFocusSelectors: string[];
}
