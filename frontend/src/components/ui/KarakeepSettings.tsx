'use client';

import { useState } from 'react';
import { useKarakeepPreferences } from '@/hooks/useKarakeepPreferences';
import { KarakeepError, testKarakeepConnection } from '@/lib/karakeep/client';

/** Renders the browser-local Karakeep integration configuration. */
export function KarakeepSettings() {
  const { preferences, updatePreferences } = useKarakeepPreferences();
  const [isTesting, setIsTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

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
    setIsTesting(true);
    setConnectionMessage(null);
    setConnectionError(null);
    try {
      const normalizedBaseUrl = await testKarakeepConnection({
        baseUrl: preferences.karakeepBaseUrl,
        apiToken: preferences.karakeepApiToken,
      });
      updatePreferences({
        ...preferences,
        karakeepBaseUrl: normalizedBaseUrl,
        karakeepConnectionVerified: true,
      });
      setConnectionMessage('Connection verified');
    } catch (error) {
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
          disabled={isTesting}
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
