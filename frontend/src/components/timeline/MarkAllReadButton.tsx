'use client';

import { useState } from 'react';
import { TimelineActionButton } from './TimelineActionButton';
import { timelineActionConfig } from './timelineActionConfig';

interface MarkAllReadButtonProps {
  onMarkAllRead: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

/**
 * Button that triggers mark-all-read for the active folder.
 */
export function MarkAllReadButton({ onMarkAllRead, disabled, className }: MarkAllReadButtonProps) {
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const { Icon, label, tooltip } = timelineActionConfig.markAllRead;

  const handleClick = async () => {
    setIsMarkingRead(true);
    try {
      await onMarkAllRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <TimelineActionButton
      icon={<Icon className="h-5 w-5" />}
      label={label}
      tooltip={tooltip}
      isLoading={isMarkingRead}
      disabled={isMarkingRead || disabled}
      className={className}
      onClick={() => {
        void handleClick();
      }}
    />
  );
}
