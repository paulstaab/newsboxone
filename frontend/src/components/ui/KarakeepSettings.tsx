'use client';

import { useLiveState } from '@/hooks/useLiveState';

import { useRef, useEffect } from 'react';
import { loadPreferences } from '@/lib/storage';
import { useKarakeepPreferences } from '@/hooks/useKarakeepPreferences';
import { KarakeepError, testKarakeepConnection } from '@/lib/karakeep/client';
import { getConfiguredKarakeepUrl } from '@/lib/config/env';

/** Renders the browser-local Karakeep integration configuration. */
export function KarakeepSettings() {
  const { preferences, updatePreferences } = useKarakeepPreferences();
  const mounted = useRef(true);
  const testing = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isKarakeepUrlConfigured = Boolean(getConfiguredKarakeepUrl());
  const [isTesting, setIsTesting] = useLiveState(false);
  const [connectionMessage, setConnectionMessage] = useLiveState<string | null>(null);
  const [connectionError, setConnectionError] = useLiveState<string | null>(null);

  const updateConnectionField = (field: 'karakeepBaseUrl' | 'karakeepApiToken', value: string) => {
    updatePreferences({
      ...preferences,
      [field]: value,
      karakeepEnabled: false,
      karakeepConnectionVerified: false,
    });
    setConnectionMessage(null);
    setConnectionError(null);
  };

  const handleTestConnection = async () => {
    if (testing.current) return;
    testing.current = true;
    const isCurrent = () => {
      const latest = loadPreferences();
      return (
        mounted.current &&
        latest.karakeepBaseUrl === preferences.karakeepBaseUrl &&
        latest.karakeepApiToken === preferences.karakeepApiToken
      );
    };
    setIsTesting(true);
    setConnectionMessage(null);
    setConnectionError(null);
    try {
      const normalizedBaseUrl = await testKarakeepConnection({
        baseUrl: preferences.karakeepBaseUrl,
        apiToken: preferences.karakeepApiToken,
      });
      if (!isCurrent()) return;
      updatePreferences({
        ...preferences,
        karakeepBaseUrl: normalizedBaseUrl,
        karakeepConnectionVerified: true,
      });
      setConnectionMessage('Connection verified');
    } catch (error) {
      if (!isCurrent()) return;
      updatePreferences({
        ...preferences,
        karakeepEnabled: false,
        karakeepConnectionVerified: false,
      });
      setConnectionError(
        error instanceof KarakeepError
          ? error.message
          : 'Could not verify the Karakeep connection.',
      );
    } finally {
      testing.current = false;
      setIsTesting(false);
    }
  };

  return (
    <section className="karakeep-settings" aria-labelledby="karakeep-settings-title">
      <div className="karakeep-settings__header">
        <div>
          <h2 id="karakeep-settings-title">Karakeep</h2>
          <p>Save timeline articles directly from this browser.</p>
        </div>
        <label className="karakeep-settings__toggle">
          <input
            type="checkbox"
            checked={preferences.karakeepEnabled}
            disabled={!preferences.karakeepConnectionVerified}
            onChange={(event) => {
              updatePreferences({ ...preferences, karakeepEnabled: event.target.checked });
            }}
          />
          <span>Enabled</span>
        </label>
      </div>

      <label className="karakeep-settings__field">
        <span>Server URL</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://karakeep.example"
          value={preferences.karakeepBaseUrl}
          disabled={isTesting || isKarakeepUrlConfigured}
          onChange={(event) => {
            updateConnectionField('karakeepBaseUrl', event.target.value);
          }}
        />
      </label>

      <label className="karakeep-settings__field">
        <span>API key</span>
        <input
          type="password"
          autoComplete="off"
          placeholder="Karakeep API key"
          value={preferences.karakeepApiToken}
          disabled={isTesting}
          onChange={(event) => {
            updateConnectionField('karakeepApiToken', event.target.value);
          }}
        />
      </label>

      <button
        type="button"
        className="karakeep-settings__test"
        disabled={isTesting}
        onClick={() => {
          void handleTestConnection();
        }}
      >
        {isTesting ? 'Testing...' : 'Test connection'}
      </button>

      {connectionMessage ? (
        <p className="karakeep-settings__status karakeep-settings__status--success" role="status">
          {connectionMessage}
        </p>
      ) : null}
      {connectionError ? (
        <p className="karakeep-settings__status karakeep-settings__status--error" role="alert">
          {connectionError}
        </p>
      ) : null}
    </section>
  );
}
