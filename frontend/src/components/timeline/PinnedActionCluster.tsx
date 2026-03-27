'use client';

import { useEffect, useState } from 'react';
import { TimelineActionButton } from './TimelineActionButton';
import { timelineActionConfig } from './timelineActionConfig';

interface PinnedActionClusterProps {
  onSync: () => void;
  onSkip: () => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  disableSkip?: boolean;
  disableMarkAllRead?: boolean;
  isSyncing?: boolean;
}

/**
 * Renders floating timeline action buttons.
 */
export function PinnedActionCluster({
  onSync,
  onSkip,
  onMarkAllRead,
  disableSkip = false,
  disableMarkAllRead = false,
  isSyncing = false,
}: PinnedActionClusterProps) {
  const [isSkipping, setIsSkipping] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const syncConfig = timelineActionConfig.sync;
  const skipConfig = timelineActionConfig.skip;
  const markAllConfig = timelineActionConfig.markAllRead;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        if (!isSyncing) {
          onSync();
        }
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!disableSkip && !isSkipping) {
          setIsSkipping(true);
          void onSkip().finally(() => {
            setIsSkipping(false);
          });
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!disableMarkAllRead && !isMarkingRead) {
          setIsMarkingRead(true);
          void onMarkAllRead().finally(() => {
            setIsMarkingRead(false);
          });
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [
    disableMarkAllRead,
    disableSkip,
    isMarkingRead,
    isSkipping,
    isSyncing,
    onMarkAllRead,
    onSkip,
    onSync,
  ]);

  return (
    <div
      className="z-[60] flex flex-col gap-3"
      style={{
        position: 'fixed',
        right: '1.5rem',
        bottom: '1.5rem',
      }}
    >
      <TimelineActionButton
        icon={<syncConfig.Icon className="h-5 w-5" />}
        label={syncConfig.label}
        tooltip={syncConfig.tooltip}
        isLoading={isSyncing}
        onClick={onSync}
      />
      <TimelineActionButton
        icon={<skipConfig.Icon className="h-5 w-5" />}
        label={skipConfig.label}
        tooltip={skipConfig.tooltip}
        disabled={disableSkip || isSkipping}
        isLoading={isSkipping}
        onClick={() => {
          if (disableSkip || isSkipping) return;
          setIsSkipping(true);
          void onSkip().finally(() => {
            setIsSkipping(false);
          });
        }}
      />
      <TimelineActionButton
        icon={<markAllConfig.Icon className="h-5 w-5" />}
        label={markAllConfig.label}
        tooltip={markAllConfig.tooltip}
        disabled={disableMarkAllRead || isMarkingRead}
        isLoading={isMarkingRead}
        onClick={() => {
          if (disableMarkAllRead || isMarkingRead) return;
          setIsMarkingRead(true);
          void onMarkAllRead().finally(() => {
            setIsMarkingRead(false);
          });
        }}
      />
    </div>
  );
}
