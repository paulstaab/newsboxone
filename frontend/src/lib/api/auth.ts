/**
 * Authentication API implementation.
 */

import { issueToken, revokeCurrentToken, validateCredentials } from './client';
import type { AuthApi } from './types';

/**
 * Authentication endpoint group implementation.
 */
export const authApi: AuthApi = {
  validateCredentials: async (username: string, password: string, rememberDevice: boolean) =>
    validateCredentials(username, password, rememberDevice),
  issueToken: async (username: string, password: string, rememberDevice: boolean) =>
    issueToken(username, password, rememberDevice),
  logout: async () => revokeCurrentToken(),
};
