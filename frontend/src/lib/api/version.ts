/**
 * Version API implementation for connectivity validation.
 */

import { ApiError, NetworkError } from './client';
import type { VersionApi, VersionResponse } from './types';
import { CONFIG } from '@/lib/config/env';

export type { VersionResponse };

/**
 * Version endpoint group implementation.
 */
export const versionApi: VersionApi = {
  get: async () => {
    try {
      const response = await fetch(`${CONFIG.API_PATH}/version`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new ApiError(response.status, response.statusText);
      }

      return (await response.json()) as VersionResponse;
    } catch (error) {
      if (error instanceof TypeError) {
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes('cors') ||
          errorMessage.includes('access-control-allow-origin') ||
          errorMessage.includes('cross-origin')
        ) {
          throw new NetworkError(
            'Server is not configured to allow cross-origin requests from this application. ' +
              'Please ensure CORS is properly configured on the server with Access-Control-Allow-Origin headers.',
          );
        }

        throw new NetworkError(
          'Unable to connect to server. Please check the URL and your network connection.',
        );
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new NetworkError('An unexpected error occurred while connecting to the server.');
    }
  },
};
