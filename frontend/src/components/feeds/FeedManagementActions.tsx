import { faCompass, faFolderPlus, faPlus, faRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { TimelineActionButton } from '@/components/timeline/TimelineActionButton';

interface FeedManagementActionsProps {
  busyLabel: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCreateFolder: () => void;
  onSubscribe: () => void;
  onDiscover: () => void;
}

/**
 * Floating feed-management action cluster.
 */
export function FeedManagementActions({
  busyLabel,
  isRefreshing,
  onCreateFolder,
  onRefresh,
  onSubscribe,
  onDiscover,
}: FeedManagementActionsProps) {
  return (
    <div className="feed-management-actions">
      <TimelineActionButton
        icon={<FontAwesomeIcon icon={faRotate} className="h-5 w-5" aria-hidden="true" />}
        label={isRefreshing ? 'Updating feeds' : 'Update feeds'}
        tooltip="Update feeds"
        disabled={busyLabel !== null}
        isLoading={isRefreshing}
        onClick={onRefresh}
      />
      <TimelineActionButton
        icon={<FontAwesomeIcon icon={faFolderPlus} className="h-5 w-5" aria-hidden="true" />}
        label="Add folder"
        tooltip="Add folder"
        disabled={busyLabel !== null}
        onClick={onCreateFolder}
      />
      <TimelineActionButton
        icon={<FontAwesomeIcon icon={faCompass} className="h-5 w-5" aria-hidden="true" />}
        label="Discover feeds"
        tooltip="Discover feeds"
        disabled={busyLabel !== null}
        onClick={onDiscover}
      />
      <TimelineActionButton
        icon={<FontAwesomeIcon icon={faPlus} className="h-5 w-5" aria-hidden="true" />}
        label="Subscribe to feed"
        tooltip="Subscribe to feed"
        disabled={busyLabel !== null}
        onClick={onSubscribe}
      />
    </div>
  );
}
