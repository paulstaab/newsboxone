/**
 * Prefetch manager for timeline items
 *
 * Implements 75% scroll prefetch strategy:
 * - Monitors scroll position
 * - Triggers prefetch when user reaches 75% of current content
 * - Manages prefetch state to avoid duplicate requests
 */

export interface PrefetchOptions {
  /** Scroll percentage threshold to trigger prefetch (0-1) */
  threshold?: number;
  /** Callback to execute when threshold is reached */
  onPrefetch: () => void;
  /** Whether prefetching is enabled */
  enabled?: boolean;
}

export class PrefetchManager {
  private threshold: number;
  private onPrefetch: () => void;
  private enabled: boolean;
  private isPrefetching = false;
  private lastScrollPosition = 0;

  constructor(options: PrefetchOptions) {
    this.threshold = options.threshold ?? 0.75;
    this.onPrefetch = options.onPrefetch;
    this.enabled = options.enabled ?? true;
  }

  /**
   * Check scroll position and trigger prefetch if threshold is reached
   */
  checkScroll(): void {
    if (!this.enabled || this.isPrefetching) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    // Only check if scrolling down
    if (scrollTop < this.lastScrollPosition) {
      this.lastScrollPosition = scrollTop;
      return;
    }

    this.lastScrollPosition = scrollTop;

    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage >= this.threshold) {
      this.triggerPrefetch();
    }
  }

  /**
   * Trigger prefetch callback
   */
  private triggerPrefetch(): void {
    if (this.isPrefetching) return;

    this.isPrefetching = true;

    try {
      this.onPrefetch();
    } finally {
      // Reset prefetching state after a delay to prevent rapid repeated calls
      setTimeout(() => {
        this.isPrefetching = false;
      }, 1000);
    }
  }

  /**
   * Enable or disable prefetching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reset prefetch state
   */
  reset(): void {
    this.isPrefetching = false;
    this.lastScrollPosition = 0;
  }

  /**
   * Update threshold
   */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }
}

/**
 * Create a throttled scroll handler to optimize performance
 */
export function createThrottledScrollHandler(handler: () => void, delay = 100): () => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  return () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= delay) {
      // Execute immediately if enough time has passed
      lastCallTime = now;
      handler();
    } else {
      // Schedule execution after remaining delay
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        handler();
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Calculate optimal batch size based on viewport height
 * Ensures at least 2 screens worth of content for smooth scrolling
 */
export function calculateOptimalBatchSize(
  itemHeight: number,
  minBatchSize = 20,
  maxBatchSize = 100,
): number {
  const viewportHeight = window.innerHeight;
  const itemsPerScreen = Math.ceil(viewportHeight / itemHeight);

  // Load at least 2 screens worth of content
  const optimalSize = itemsPerScreen * 2;

  return Math.max(minBatchSize, Math.min(maxBatchSize, optimalSize));
}

/**
 * Check if browser is likely offline
 */
export function isLikelyOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Prefetch image resources for upcoming items
 * Helps with smooth scrolling experience
 */
export function prefetchImages(imageUrls: string[], maxConcurrent = 3): void {
  if (isLikelyOffline()) return;

  let inFlight = 0;
  let index = 0;

  function prefetchNext() {
    if (index >= imageUrls.length || inFlight >= maxConcurrent) return;

    const url = imageUrls[index++];
    inFlight++;

    const img = new Image();
    img.onload = img.onerror = () => {
      inFlight--;
      prefetchNext();
    };
    img.src = url;

    // Start next prefetch immediately (up to maxConcurrent)
    prefetchNext();
  }

  prefetchNext();
}
