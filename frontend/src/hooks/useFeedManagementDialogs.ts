'use client';

import { useCallback, useRef } from 'react';

/**
 * Owns dialog refs and simple open/close commands for feed management.
 */
export function useFeedManagementDialogs() {
  const createFeedDialogRef = useRef<HTMLDialogElement>(null);
  const createFolderDialogRef = useRef<HTMLDialogElement>(null);
  const qualityDialogRef = useRef<HTMLDialogElement>(null);
  const discoveryDialogRef = useRef<HTMLDialogElement>(null);

  const openCreateFeedDialog = useCallback(() => {
    createFeedDialogRef.current?.showModal();
  }, []);

  const closeCreateFeedDialog = useCallback(() => {
    createFeedDialogRef.current?.close();
  }, []);

  return {
    createFeedDialogRef,
    createFolderDialogRef,
    qualityDialogRef,
    discoveryDialogRef,
    openCreateFeedDialog,
    closeCreateFeedDialog,
  };
}
