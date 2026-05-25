'use client';

/**
 * Shared burger menu for navigation and install actions.
 */

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { triggerInstallPrompt, canPromptInstall } from '@/lib/pwa/installPrompt';

export interface SettingsMenuProps {
  /**
   * Position of the menu button.
   * Default: 'top-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Additional CSS classes for the button.
   */
  className?: string;
}

/**
 * Renders the shared burger menu trigger and panel.
 */
export function SettingsMenu({ position = 'top-right', className = '' }: SettingsMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showInstallOption, setShowInstallOption] = useState(canPromptInstall);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleInstall = async () => {
    setIsInstalling(true);
    await triggerInstallPrompt();
    setIsInstalling(false);
    setIsOpen(false);

    // Check again if install is still available
    setShowInstallOption(canPromptInstall());
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      setIsOpen(false);
      setIsLoggingOut(false);
      router.push('/login');
    }
  };

  const positionStyles: Record<NonNullable<SettingsMenuProps['position']>, CSSProperties> = {
    'top-left': { top: 'var(--space-4)', left: 'var(--space-4)' },
    'top-right': { top: 'var(--space-4)', right: 'var(--space-6)' },
    'bottom-left': { bottom: 'var(--space-4)', left: 'var(--space-4)' },
    'bottom-right': { bottom: 'var(--space-4)', right: 'var(--space-6)' },
  };

  return (
    <div ref={menuRef} className={`app-menu ${className}`.trim()} style={positionStyles[position]}>
      {/* Burger menu button */}
      <button
        type="button"
        id="settings-menu-button"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className="app-menu__button"
        aria-label="Burger menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="app-menu__button-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17h16" />
        </svg>
      </button>

      {/* Burger menu dropdown */}
      {isOpen && (
        <div
          className="app-menu__panel"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="settings-menu-button"
        >
          <div className="app-menu__content">
            <Link
              href="/timeline"
              className="app-menu__item"
              role="menuitem"
              aria-current={pathname === '/timeline' ? 'page' : undefined}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <svg
                className="app-menu__icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12h18M3 6h18M3 18h18"
                />
              </svg>
              <span>Timeline</span>
            </Link>

            <Link
              href="/feeds"
              className="app-menu__item"
              role="menuitem"
              aria-current={pathname === '/feeds' ? 'page' : undefined}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <svg
                className="app-menu__icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7h16M4 12h10M4 17h16"
                />
              </svg>
              <span>Feed Management</span>
            </Link>

            <Link
              href="/about"
              className="app-menu__item"
              role="menuitem"
              aria-current={pathname === '/about' ? 'page' : undefined}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <svg
                className="app-menu__icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>About NewsBoxOne</span>
            </Link>

            {/* Install App Option */}
            <button
              type="button"
              onClick={() => {
                void handleInstall();
              }}
              disabled={!showInstallOption || isInstalling}
              className="app-menu__item"
              role="menuitem"
              aria-label={showInstallOption ? 'Install App' : 'Install not available'}
              title={
                showInstallOption
                  ? 'Install NewsBoxOne as an app'
                  : 'App is already installed or install is not available'
              }
            >
              <svg
                className="app-menu__icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span>{isInstalling ? 'Installing...' : 'Install App'}</span>
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                className="app-menu__item"
                role="menuitem"
                onClick={() => {
                  void handleLogout();
                }}
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? 'Signing out' : 'Logout'}
              >
                <svg
                  className="app-menu__icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 17l5-5m0 0l-5-5m5 5H9"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 22H6a2 2 0 01-2-2V4a2 2 0 012-2h7"
                  />
                </svg>
                <span>{isLoggingOut ? 'Signing out...' : 'Logout'}</span>
              </button>
            ) : null}

            {/* Divider */}
            <div className="app-menu__divider" />

            {/* Version Info */}
            <div className="app-menu__version">Version 1.0.0</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
