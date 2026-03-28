'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadSession, storeSession, clearSession } from '@/lib/storage';
import { getApiClient } from '@/lib/api/apiClient';
import type { UserSessionConfig } from '@/types';
import { toStoredSession, toUserSessionConfig } from '@/lib/auth/session';

interface AuthContextValue {
  /** Current session configuration (null if not authenticated) */
  session: UserSessionConfig | null;

  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Whether authentication is in progress */
  isLoading: boolean;

  /** Whether initial session load from storage is in progress */
  isInitializing: boolean;

  /** Last authentication error */
  error: string | null;

  /**
   * Authenticate user with same-origin API credentials.
   * Exchanges credentials for a backend-issued browser token.
   * Stores session in storage on success
   */
  login: (username: string, password: string, rememberDevice?: boolean) => Promise<void>;

  /**
   * Clear authentication and remove stored session
   */
  logout: () => Promise<void>;

  /**
   * Update session preferences
   */
  updatePreferences: (
    preferences: Partial<Pick<UserSessionConfig, 'viewMode' | 'sortOrder' | 'showRead'>>,
  ) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeExpiry(rawExpiresAt: string | number): string {
  if (typeof rawExpiresAt === 'number') {
    return new Date(rawExpiresAt * 1000).toISOString();
  }

  return new Date(rawExpiresAt).toISOString();
}

/**
 * Provides authentication state and actions to the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const apiClient = getApiClient();
  const [session, setSession] = useState<UserSessionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session from storage on mount
  useEffect(() => {
    const loadStoredSession = () => {
      const stored = loadSession();
      if (stored) {
        setSession(toUserSessionConfig(stored));
      }
      setIsInitializing(false);
    };

    loadStoredSession();
  }, []);

  const login = useCallback(
    async (username: string, password: string, rememberDevice?: boolean) => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate required fields
        if (!username.trim()) {
          throw new Error('Username is required');
        }

        if (!password) {
          throw new Error('Password is required');
        }

        const validationResult = await apiClient.auth.validateCredentials(
          username.trim(),
          password,
          rememberDevice ?? false,
        );

        if (!validationResult.valid || !validationResult.token) {
          throw new Error(validationResult.error ?? 'Authentication failed');
        }

        const expiresAt = normalizeExpiry(validationResult.token.expiresAt);

        const newSession: UserSessionConfig = {
          username: username.trim(),
          token: validationResult.token.token,
          expiresAt,
          rememberDevice: rememberDevice ?? false,
          viewMode: 'card',
          sortOrder: 'newest',
          showRead: false,
          lastSyncAt: new Date().toISOString(),
        };

        // Store session
        storeSession(toStoredSession(newSession));

        // Update state
        setSession(newSession);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch {
      // Local sign-out should still succeed even when the server-side token is already invalid.
    }

    clearSession();
    setSession(null);
    setError(null);
  }, [apiClient]);

  const updatePreferences = useCallback(
    (preferences: Partial<Pick<UserSessionConfig, 'viewMode' | 'sortOrder' | 'showRead'>>) => {
      if (!session) return;

      const updatedSession: UserSessionConfig = {
        ...session,
        ...preferences,
      };

      // Store updated session
      storeSession(toStoredSession(updatedSession));

      // Update state
      setSession(updatedSession);
    },
    [session],
  );

  const value: AuthContextValue = {
    session,
    isAuthenticated: session !== null,
    isLoading,
    isInitializing,
    error,
    login,
    logout,
    updatePreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the current auth context.
 * Must be used within `AuthProvider`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
