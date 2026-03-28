import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAnglesRight, faCheckDouble, faRotate } from '@fortawesome/free-solid-svg-icons';

interface IconProps {
  className?: string;
}

/**
 * Sync action icon.
 */
export function SyncIcon({ className }: IconProps) {
  return <FontAwesomeIcon icon={faRotate} className={className} aria-hidden="true" />;
}

/**
 * Skip action icon.
 */
export function SkipIcon({ className }: IconProps) {
  return <FontAwesomeIcon icon={faAnglesRight} className={className} aria-hidden="true" />;
}

/**
 * Mark-all-read action icon.
 */
export function MarkAllReadIcon({ className }: IconProps) {
  return <FontAwesomeIcon icon={faCheckDouble} className={className} aria-hidden="true" />;
}
