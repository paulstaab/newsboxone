/**
 * Client-side queue for optimistic updates; tracks pending API mutations.
 */
export interface ReadStateMutation {
  /** Unique mutation ID (UUID) */
  id: string;

  /** Type of mutation */
  type: MutationType;

  /** Target item/feed/folder ID(s) */
  targetIds: number[];

  /** For star/unstar: guidHash values */
  guidHashes?: string[];

  /** ISO 8601 timestamp when mutation was queued */
  createdAt: string;

  /** Current status */
  status: MutationStatus;

  /** Error message if failed */
  error?: string;

  /** Retry count */
  retryCount: number;

  /** Maximum retries before giving up */
  maxRetries: number;

  /** Previous state for rollback */
  rollbackData: RollbackData;
}

export type MutationType =
  | 'markRead'
  | 'markUnread'
  | 'star'
  | 'unstar'
  | 'markFeedRead'
  | 'markFolderRead';

export type MutationStatus = 'pending' | 'in-flight' | 'success' | 'failed';

export interface RollbackData {
  itemStates: Map<number, ItemState>;
}

export interface ItemState {
  unread: boolean;
  starred: boolean;
}

/** Default max retries for mutation queue */
export const DEFAULT_MAX_RETRIES = 3;

/** Creates a new mutation with default values */
export function createMutation(
  type: MutationType,
  targetIds: number[],
  rollbackData: RollbackData,
  guidHashes?: string[],
): ReadStateMutation {
  return {
    id: crypto.randomUUID(),
    type,
    targetIds,
    guidHashes,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    rollbackData,
  };
}

/** Serializable version of RollbackData for JSON storage */
export interface SerializableRollbackData {
  itemStates: [number, ItemState][];
}

/** Convert RollbackData to serializable form */
export function serializeRollbackData(data: RollbackData): SerializableRollbackData {
  return {
    itemStates: Array.from(data.itemStates.entries()),
  };
}

/** Convert serializable form back to RollbackData */
export function deserializeRollbackData(data: SerializableRollbackData): RollbackData {
  return {
    itemStates: new Map(data.itemStates),
  };
}
