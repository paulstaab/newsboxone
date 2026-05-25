import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsMenu } from '@/components/ui/SettingsMenu';

const { mockPush, mockLogout, mockAuthState } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockLogout: vi.fn<() => Promise<void>>(),
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/timeline',
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: mockAuthState.isAuthenticated
      ? {
          username: 'test',
          token: 'token',
          expiresAt: '2026-05-05T00:00:00.000Z',
          rememberDevice: false,
          viewMode: 'card',
          sortOrder: 'newest',
          showRead: false,
          lastSyncAt: '2026-05-05T00:00:00.000Z',
        }
      : null,
    isAuthenticated: mockAuthState.isAuthenticated,
    isLoading: false,
    isInitializing: false,
    error: null,
    login: vi.fn(),
    logout: mockLogout,
    updatePreferences: vi.fn(),
  }),
}));

vi.mock('@/lib/pwa/installPrompt', () => ({
  canPromptInstall: () => false,
  triggerInstallPrompt: vi.fn(),
}));

function createDeferredPromise() {
  let resolve!: () => void;

  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('SettingsMenu', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockLogout.mockReset();
    mockAuthState.isAuthenticated = true;
  });

  it('shows logout for authenticated users and signs out once with redirect', async () => {
    const user = userEvent.setup();
    const deferred = createDeferredPromise();
    mockLogout.mockImplementation(() => deferred.promise);

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /burger menu/i }));

    const logoutButton = screen.getByRole('menuitem', { name: /logout/i });
    await user.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menuitem', { name: /signing out/i })).toBeDisabled();

    await user.click(screen.getByRole('menuitem', { name: /signing out/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);

    deferred.resolve();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /signing out/i })).toBeNull();
    });
  });

  it('hides logout for signed-out users', async () => {
    const user = userEvent.setup();
    mockAuthState.isAuthenticated = false;

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /burger menu/i }));

    expect(screen.queryByRole('menuitem', { name: /logout/i })).toBeNull();
  });

  it('shows the about entry and closes the menu after it is selected', async () => {
    const user = userEvent.setup();

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /burger menu/i }));

    const aboutLink = screen.getByRole('menuitem', { name: /about newsboxone/i });
    expect(aboutLink).toHaveAttribute('href', '/about');

    await user.click(aboutLink);

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /about newsboxone/i })).toBeNull();
    });
  });
});
