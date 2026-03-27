'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadSession, storeSession, clearSession } from '@/lib/storage';
import { validateCredentials } from '@/lib/api/client';
import type { UserSessionConfig } from '@/types';
import { encodeBasicCredentials, toStoredSession, toUserSessionConfig } from '@/lib/auth/session';

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
   * Validates credentials by calling a protected API endpoint.
   * Stores session in storage on success
   */
  login: (username: string, password: string, rememberDevice?: boolean) => Promise<void>;

  /**
   * Clear authentication and remove stored session
   */
  logout: () => void;

  /**
   * Update session preferences
   */
  updatePreferences: (
    preferences: Partial<Pick<UserSessionConfig, 'viewMode' | 'sortOrder' | 'showRead'>>,
  ) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides authentication state and actions to the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
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

        // Encode credentials
        const credentials = encodeBasicCredentials(username, password);

        // Validate credentials by calling the API with explicit credentials
        // This avoids relying on storage which hasn't been set yet
        const validationResult = await validateCredentials(credentials);

        if (!validationResult.valid) {
          throw new Error(validationResult.error ?? 'Authentication failed');
        }

        // If we get here, credentials are valid - create the session
        const newSession: UserSessionConfig = {
          username: username.trim(),
          credentials,
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
    [],
  );

  const logout = useCallback(() => {
    // Clear session from both storage types
    clearSession();

    // Clear state
    setSession(null);
    setError(null);
  }, []);

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
