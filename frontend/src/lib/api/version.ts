/**
 * Version API wrapper for connectivity validation.
 * The /version endpoint does not require authentication.
 *
 * Re-exports from the centralized API client for backward compatibility.
 */

import { api, type VersionResponse } from './apiClient';

export type { VersionResponse };

/**
 * Fetches API version information from the same-origin NewsBoxOne API.
 *
 * @returns Version information if server is reachable
 * @throws {NetworkError} If server is unreachable
 * @throws {ApiError} If response is invalid
 *
 * @example
 * ```ts
 * try {
 *   const version = await getVersion();
 *   console.log(`Server version: ${version.version}`);
 * } catch (error) {
 *   console.error('Server unreachable:', error);
 * }
 * ```
 */
export async function getVersion(): Promise<VersionResponse> {
  return api.version.get();
}
