'use client';

import { useEffect, useRef } from 'react';
import type { FolderQueueEntry } from '@/types';

interface FolderQueuePillsProps {
  queue: FolderQueueEntry[];
  activeFolderId: number | null;
  onSelect: (folderId: number) => void;
  isLoading?: boolean;
}

/**
 * Renders selectable folder queue pills.
 */
export function FolderQueuePills({
  queue,
  activeFolderId,
  onSelect,
  isLoading = false,
}: FolderQueuePillsProps) {
  const pillRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0, moved: false });

  useEffect(() => {
    if (typeof activeFolderId !== 'number') return;
    const activePill = pillRefs.current[activeFolderId];
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeFolderId, queue.length]);

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="folder-pills">
      {isLoading && (
        <div className="folder-pills__status">
          <span className="folder-pills__status-text">Updating…</span>
        </div>
      )}
      <div
        ref={listRef}
        className="folder-pills__list"
        role="tablist"
        aria-label="Unread folder queue"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const target = listRef.current;
          if (!target) return;
          dragState.current = {
            isDragging: true,
            startX: event.clientX,
            scrollLeft: target.scrollLeft,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const target = listRef.current;
          if (!target || !dragState.current.isDragging) return;
          const delta = event.clientX - dragState.current.startX;
          if (Math.abs(delta) > 4) {
            dragState.current.moved = true;
          }
          target.scrollLeft = dragState.current.scrollLeft - delta;
        }}
        onPointerUp={() => {
          if (!dragState.current.isDragging) return;
          dragState.current.isDragging = false;
        }}
        onPointerLeave={() => {
          if (!dragState.current.isDragging) return;
          dragState.current.isDragging = false;
        }}
        onPointerCancel={() => {
          dragState.current.isDragging = false;
        }}
      >
        {queue.map((entry) => {
          const isActive = entry.id === activeFolderId;
          const label = `${entry.name} (${String(entry.unreadCount)})`;
          const isSkipped = entry.status === 'skipped';

          return (
            <button
              key={entry.id}
              ref={(node) => {
                pillRefs.current[entry.id] = node;
              }}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => {
                if (dragState.current.moved) {
                  dragState.current.moved = false;
                  return;
                }
                onSelect(entry.id);
              }}
              className={`folder-pill${isActive ? ' folder-pill--active' : ''}${
                isSkipped ? ' folder-pill--skipped' : ''
              }`}
              data-testid={`folder-pill-${String(entry.id)}`}
            >
              <span className="folder-pill__name">{entry.name}</span>
              <span className="folder-pill__count">({entry.unreadCount})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
