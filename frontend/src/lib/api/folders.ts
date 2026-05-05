/**
 * Typed domain implementation for the Folders API.
 */

import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { FoldersApi } from './types';
import { type Folder, type FoldersResponse, normalizeFolder } from '@/types';

/**
 * Folder endpoint group implementation.
 */
export const foldersApi: FoldersApi = {
  getAll: async () => {
    const response = await apiGet<FoldersResponse>('/folders');
    return response.folders.map(normalizeFolder);
  },

  create: async (name: string) => {
    const response = await apiPost<FoldersResponse>('/folders', { name });
    const folders = response.folders.map(normalizeFolder);
    if (folders.length === 0) {
      throw new Error('No folder returned from create operation');
    }
    return folders[0];
  },

  rename: async (folderId: number, name: string) => {
    await apiPut(`/folders/${String(folderId)}`, { name });
  },

  delete: async (folderId: number) => {
    await apiDelete(`/folders/${String(folderId)}`);
  },

  markRead: async (folderId: number, newestItemId: number) => {
    await apiPost(`/folders/${String(folderId)}/read`, { newestItemId });
  },
};

/**
 * Fetches all folders.
 */
export async function getFolders(): Promise<Folder[]> {
  return foldersApi.getAll();
}

/**
 * Creates a new folder.
 */
export async function createFolder(name: string): Promise<Folder> {
  return foldersApi.create(name);
}

/**
 * Renames an existing folder.
 */
export async function renameFolder(folderId: number, name: string): Promise<void> {
  return foldersApi.rename(folderId, name);
}

/**
 * Deletes a folder.
 */
export async function deleteFolder(folderId: number): Promise<void> {
  return foldersApi.delete(folderId);
}

/**
 * Marks all items in a folder as read.
 */
export async function markFolderRead(folderId: number, newestItemId: number): Promise<void> {
  return foldersApi.markRead(folderId, newestItemId);
}
