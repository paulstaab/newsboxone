import { DEFAULT_PREFERENCES } from '@/types';
import { CONFIG } from '@/lib/config/env';
import { loadPreferences, storePreferences } from '@/lib/storage';

describe('Karakeep runtime configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__NEWSBOXONE_CONFIG__;
  });

  it('prefills the deployment URL and resets verification for a different stored URL', () => {
    localStorage.setItem(
      CONFIG.PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_PREFERENCES,
        karakeepBaseUrl: 'https://old.example',
        karakeepEnabled: true,
        karakeepConnectionVerified: true,
      }),
    );
    window.__NEWSBOXONE_CONFIG__ = { karakeepUrl: 'https://karakeep.example' };

    expect(loadPreferences()).toMatchObject({
      karakeepBaseUrl: 'https://karakeep.example',
      karakeepEnabled: false,
      karakeepConnectionVerified: false,
    });
    expect(JSON.parse(localStorage.getItem(CONFIG.PREFERENCES_KEY) ?? '{}')).toMatchObject({
      karakeepBaseUrl: 'https://karakeep.example',
      karakeepEnabled: false,
      karakeepConnectionVerified: false,
    });
  });

  it('preserves verification for the configured URL', () => {
    localStorage.setItem(
      CONFIG.PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_PREFERENCES,
        karakeepBaseUrl: 'https://karakeep.example',
        karakeepEnabled: true,
        karakeepConnectionVerified: true,
      }),
    );
    window.__NEWSBOXONE_CONFIG__ = { karakeepUrl: 'https://karakeep.example' };

    expect(loadPreferences()).toMatchObject({
      karakeepEnabled: true,
      karakeepConnectionVerified: true,
    });
  });

  it('keeps the deployment URL when preferences are stored', () => {
    window.__NEWSBOXONE_CONFIG__ = { karakeepUrl: 'https://karakeep.example' };

    storePreferences({
      ...DEFAULT_PREFERENCES,
      karakeepBaseUrl: 'https://changed.example',
      karakeepApiToken: 'secret',
    });

    expect(JSON.parse(localStorage.getItem(CONFIG.PREFERENCES_KEY) ?? '{}')).toMatchObject({
      karakeepBaseUrl: 'https://karakeep.example',
      karakeepApiToken: 'secret',
    });
  });
});
