import type { JSX } from 'react';
import { MarkAllReadIcon, SkipIcon, SyncIcon } from './TimelineActionIcons';

export type TimelineActionKey = 'sync' | 'skip' | 'markAllRead';

export interface TimelineActionConfig {
  label: string;
  tooltip: string;
  Icon: (props: { className?: string }) => JSX.Element;
}

/**
 * Configuration for timeline action buttons.
 */
export const timelineActionConfig: Record<TimelineActionKey, TimelineActionConfig> = {
  sync: {
    label: 'Refresh',
    tooltip: 'Refresh unread items (R)',
    Icon: SyncIcon,
  },
  skip: {
    label: 'Skip',
    tooltip: 'Skip this folder (→)',
    Icon: SkipIcon,
  },
  markAllRead: {
    label: 'Mark all read',
    tooltip: 'Mark all items as read (↩︎)',
    Icon: MarkAllReadIcon,
  },
};
