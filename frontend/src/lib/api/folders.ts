/**
 * Typed domain wrapper for the Folders API.
 * Aligned with contracts/folders.md
 *
 * Re-exports from the centralized API client for backward compatibility.
 */

import { api } from './apiClient';
import type { Folder } from '@/types';

/**
 * Fetches all folders.
 */
export async function getFolders(): Promise<Folder[]> {
  return api.folders.getAll();
}

/**
 * Creates a new folder.
 */
export async function createFolder(name: string): Promise<Folder> {
  return api.folders.create(name);
}

/**
 * Renames an existing folder.
 */
export async function renameFolder(folderId: number, name: string): Promise<void> {
  return api.folders.rename(folderId, name);
}

/**
 * Deletes a folder.
 */
export async function deleteFolder(folderId: number): Promise<void> {
  return api.folders.delete(folderId);
}

/**
 * Marks all items in a folder as read.
 */
export async function markFolderRead(folderId: number, newestItemId: number): Promise<void> {
  return api.folders.markRead(folderId, newestItemId);
}
