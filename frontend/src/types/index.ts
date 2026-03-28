// Session & preferences
export type {
  UserSessionConfig,
  ViewMode,
  SortOrder,
  StoredSession,
  UserPreferences,
} from './session';
export { DEFAULT_PREFERENCES } from './session';

// Feed entity
export type { Feed, ApiFeed, FeedsResponse } from './feed';
export { normalizeFeed } from './feed';

// Folder entity
export type {
  Folder,
  ApiFolder,
  FoldersResponse,
  FolderQueueEntry,
  FolderQueuePill,
  FolderQueueStatus,
  FolderProgressState,
  TimelineCacheEnvelope,
  MarkActionPayload,
} from './folder';
export { normalizeFolder, UNCATEGORIZED_FOLDER_ID } from './folder';

// Article entity
export type {
  Article,
  ApiArticle,
  ItemsResponse,
  ItemsQueryParams,
  ArticlePreview,
} from './article';
export { normalizeArticle, ItemFilterType } from './article';

// Sync helpers
export type { ReconciliationSweep } from './sync';

// Mutation queue
export type {
  ReadStateMutation,
  MutationType,
  MutationStatus,
  RollbackData,
  ItemState,
  SerializableRollbackData,
} from './mutation';
export {
  createMutation,
  serializeRollbackData,
  deserializeRollbackData,
  DEFAULT_MAX_RETRIES,
} from './mutation';

// Timeline feature types
export type {
  TimelineViewportState,
  ArticleWithSessionState,
  FolderQueueDockingState,
  SelectionNavigationState,
  SelectionActions,
  LocalReadState,
  KeyboardContext,
} from './timeline';
