import { render, screen } from '@testing-library/react';
import { KarakeepSettings } from '@/components/ui/KarakeepSettings';

describe('KarakeepSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__NEWSBOXONE_CONFIG__;
  });

  it('locks a deployment-provided URL but keeps the API key editable', () => {
    window.__NEWSBOXONE_CONFIG__ = { karakeepUrl: 'https://karakeep.example' };

    render(<KarakeepSettings />);

    expect(screen.getByLabelText('Server URL')).toHaveValue('https://karakeep.example');
    expect(screen.getByLabelText('Server URL')).toBeDisabled();
    expect(screen.getByLabelText('API key')).toBeEnabled();
  });
});
