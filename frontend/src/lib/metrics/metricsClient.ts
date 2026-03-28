'use client';

/**
 * Metrics and instrumentation client.
 * Tracks last-sync timestamps, diagnostics, and performance metrics.
 */

import { CONFIG } from '@/lib/config/env';

/**
 * Metrics data structure stored in localStorage.
 */
export interface MetricsData {
  /** ISO 8601 timestamp of last successful sync */
  lastSyncAt: string | null;
  /** Unix timestamp of last successful sync (ms) */
  lastSyncTimestamp: number | null;
  /** Count of successful syncs */
  syncCount: number;
  /** Count of failed syncs */
  errorCount: number;
  /** Last error message if any */
  lastError: string | null;
  /** ISO 8601 timestamp of first app load */
  firstLoadAt: string;
  /** Total items fetched count */
  itemsFetched: number;
}

/**
 * Performance timing data.
 */
export interface PerformanceTiming {
  /** Navigation start to DOM ready */
  domReady: number;
  /** Navigation start to load complete */
  loadComplete: number;
  /** Time to First Byte */
  ttfb: number;
  /** Time to First Contentful Paint */
  fcp: number | null;
  /** Largest Contentful Paint */
  lcp: number | null;
}

/**
 * Default metrics data.
 */
const DEFAULT_METRICS: MetricsData = {
  lastSyncAt: null,
  lastSyncTimestamp: null,
  syncCount: 0,
  errorCount: 0,
  lastError: null,
  firstLoadAt: new Date().toISOString(),
  itemsFetched: 0,
};

/**
 * Loads metrics from storage.
 */
export function loadMetrics(): MetricsData {
  if (typeof window === 'undefined') {
    return DEFAULT_METRICS;
  }

  try {
    const stored = localStorage.getItem(CONFIG.METRICS_KEY);
    if (!stored) {
      return DEFAULT_METRICS;
    }
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null) {
      return { ...DEFAULT_METRICS, ...(parsed as Partial<MetricsData>) };
    }
    return DEFAULT_METRICS;
  } catch {
    return DEFAULT_METRICS;
  }
}

/**
 * Saves metrics to storage.
 */
export function saveMetrics(metrics: MetricsData): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CONFIG.METRICS_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.warn('Failed to save metrics:', error);
  }
}

/**
 * Records a successful sync.
 */
export function recordSync(itemCount = 0): void {
  const metrics = loadMetrics();
  const now = new Date();

  metrics.lastSyncAt = now.toISOString();
  metrics.lastSyncTimestamp = now.getTime();
  metrics.syncCount += 1;
  metrics.itemsFetched += itemCount;
  metrics.lastError = null;

  saveMetrics(metrics);
}

/**
 * Records a sync error.
 */
export function recordError(error: string): void {
  const metrics = loadMetrics();

  metrics.errorCount += 1;
  metrics.lastError = error;

  saveMetrics(metrics);
}

/**
 * Gets the time since last sync in milliseconds.
 */
export function getTimeSinceLastSync(): number | null {
  const metrics = loadMetrics();
  if (!metrics.lastSyncTimestamp) {
    return null;
  }
  return Date.now() - metrics.lastSyncTimestamp;
}

/**
 * Checks if data is stale (older than TTL).
 */
export function isDataStale(ttlMs = CONFIG.SWR_CACHE_TTL): boolean {
  const timeSince = getTimeSinceLastSync();
  if (timeSince === null) {
    return true; // Never synced
  }
  return timeSince > ttlMs;
}

/**
 * Resets metrics to defaults.
 */
export function resetMetrics(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(CONFIG.METRICS_KEY);
}

/**
 * Check if Performance API is available.
 */
function hasPerformanceApi(): boolean {
  return typeof window !== 'undefined' && 'performance' in window;
}

/**
 * Gets performance timing data from the browser.
 */
export function getPerformanceTiming(): PerformanceTiming | null {
  if (!hasPerformanceApi()) {
    return null;
  }

  const entries = performance.getEntriesByType('navigation');
  const navigation = entries[0] as PerformanceNavigationTiming | undefined;
  if (!navigation) {
    return null;
  }

  // Get paint timing
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');

  // Try to get LCP from PerformanceObserver if available
  let lcp: number | null = null;
  try {
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      const lastLcp = lcpEntries[lcpEntries.length - 1];
      lcp = lastLcp.startTime;
    }
  } catch {
    // LCP not available
  }

  return {
    domReady: navigation.domContentLoadedEventEnd - navigation.startTime,
    loadComplete: navigation.loadEventEnd - navigation.startTime,
    ttfb: navigation.responseStart - navigation.requestStart,
    fcp: fcpEntry ? fcpEntry.startTime : null,
    lcp,
  };
}

/**
 * Logs performance metrics to console in development.
 */
export function logPerformanceMetrics(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const timing = getPerformanceTiming();
  if (!timing) {
    return;
  }

  console.group('📊 Performance Metrics');
  console.log('DOM Ready:', `${timing.domReady.toFixed(0)}ms`);
  console.log('Load Complete:', `${timing.loadComplete.toFixed(0)}ms`);
  console.log('TTFB:', `${timing.ttfb.toFixed(0)}ms`);
  if (timing.fcp) {
    console.log('FCP:', `${timing.fcp.toFixed(0)}ms`);
  }
  if (timing.lcp) {
    console.log('LCP:', `${timing.lcp.toFixed(0)}ms`);
  }
  console.groupEnd();
}

/**
 * Creates a simple performance mark.
 */
export function mark(name: string): void {
  if (!hasPerformanceApi()) {
    return;
  }
  performance.mark(name);
}

/**
 * Measures between two marks.
 */
export function measure(name: string, startMark: string, endMark?: string): number | null {
  if (!hasPerformanceApi()) {
    return null;
  }

  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }

    const entries = performance.getEntriesByName(name, 'measure');
    if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      return lastEntry.duration;
    }
  } catch {
    // Measurement failed
  }

  return null;
}

// Timeline-specific performance tracking (US5).

/**
 * Mark timeline cache load start.
 */
export function markTimelineCacheLoadStart(): void {
  mark('timeline-cache-load-start');
}

/**
 * Mark timeline cache ready (after hydration).
 */
export function markTimelineCacheReady(): void {
  mark('timeline-cache-ready');
  const duration = measure('timeline-cache-ready', 'timeline-cache-load-start');

  if (process.env.NODE_ENV === 'development' && duration !== null) {
    console.log(`📊 Timeline cache ready in ${duration.toFixed(0)}ms`);

    // Warn if exceeding 500ms target
    if (duration > 500) {
      console.warn(`⚠️ Timeline cache load exceeded 500ms target (${duration.toFixed(0)}ms)`);
    }
  }
}

/**
 * Mark timeline update start (when refresh triggered).
 */
export function markTimelineUpdateStart(): void {
  mark('timeline-update-start');
}

/**
 * Mark timeline update complete (after merge and revalidate).
 */
export function markTimelineUpdateComplete(): void {
  mark('timeline-update-complete');
  const duration = measure('timeline-update-complete', 'timeline-update-start');

  if (process.env.NODE_ENV === 'development' && duration !== null) {
    console.log(`📊 Timeline update completed in ${duration.toFixed(0)}ms`);

    // Warn if exceeding 10s target
    if (duration > 10000) {
      console.warn(`⚠️ Timeline update exceeded 10s target (${duration.toFixed(0)}ms)`);
    }
  }
}

/**
 * Get the last measured timeline cache load duration.
 */
export function getTimelineCacheLoadDuration(): number | null {
  if (!hasPerformanceApi()) {
    return null;
  }

  const entries = performance.getEntriesByName('timeline-cache-ready', 'measure');
  if (entries.length > 0) {
    const lastEntry = entries[entries.length - 1];
    return lastEntry.duration;
  }

  return null;
}

/**
 * Get the last measured timeline update duration.
 */
export function getTimelineUpdateDuration(): number | null {
  if (!hasPerformanceApi()) {
    return null;
  }

  const entries = performance.getEntriesByName('timeline-update-complete', 'measure');
  if (entries.length > 0) {
    const lastEntry = entries[entries.length - 1];
    return lastEntry.duration;
  }

  return null;
}
