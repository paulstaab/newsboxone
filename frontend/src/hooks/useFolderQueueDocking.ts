import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface FolderQueueDockingResult {
  isDocked: boolean;
  dockedHeight: number;
  queueRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

/**
 * Tracks folder queue docking state with observers.
 */
export function useFolderQueueDocking(): FolderQueueDockingResult {
  const queueRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isDocked, setIsDocked] = useState(false);
  const [dockedHeight, setDockedHeight] = useState(0);

  useEffect(() => {
    const queueElement = queueRef.current;
    const sentinelElement = sentinelRef.current;
    if (!queueElement || !sentinelElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== queueElement) continue;
        setDockedHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(queueElement);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        setIsDocked(!entry.isIntersecting);
      },
      { threshold: [0] },
    );
    intersectionObserver.observe(sentinelElement);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  return {
    isDocked,
    dockedHeight,
    queueRef,
    sentinelRef,
  };
}
