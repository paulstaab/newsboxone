'use client';

import type { FolderQueueEntry } from '@/types';

interface FolderStepperProps {
  activeFolder: FolderQueueEntry | null;
}

/**
 * Shows a compact stepper for the active folder.
 */
export function FolderStepper({ activeFolder }: FolderStepperProps) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="text-2xl font-semibold text-gray-900 mt-1"
            data-testid="active-folder-name"
          >
            {activeFolder?.name ?? 'All caught up'}
          </h2>
        </div>

        <div />
      </div>
    </section>
  );
}
