'use client';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import { LoginStep, useLoginFlow } from '@/hooks/useLoginFlow';
import { FullscreenStatus } from '@/components/ui/FullscreenStatus';

function LoginContent() {
  const { isInitializing } = useAuthGuard({ requireAuth: false });
  const {
    step,
    username,
    setUsername,
    password,
    setPassword,
    rememberDevice,
    setRememberDevice,
    validationError,
    authError,
    handleCredentialsSubmit,
  } = useLoginFlow();

  if (isInitializing) {
    return <FullscreenStatus message="Loading login..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--color-surface))] px-4 py-12 text-[hsl(var(--color-text))]">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-muted))] p-8 shadow-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-[hsl(var(--color-text))]">
              Welcome to NewsBoxOne
            </h1>
            <p className="text-[hsl(var(--color-text-muted))]">
              {step === LoginStep.CREDENTIALS && 'Sign in to your NewsBoxOne reader'}
              {step === LoginStep.AUTHENTICATING && 'Verifying credentials...'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8 flex justify-center space-x-2">
            <div
              className={`h-2 w-12 rounded-full ${step >= LoginStep.CREDENTIALS ? 'bg-[hsl(var(--color-accent-strong))]' : 'bg-[hsl(var(--color-border))]'}`}
            />
            <div
              className={`h-2 w-12 rounded-full ${step >= LoginStep.AUTHENTICATING ? 'bg-[hsl(var(--color-accent-strong))]' : 'bg-[hsl(var(--color-border))]'}`}
            />
          </div>

          {/* Error display */}
          {(validationError ?? authError) && (
            <div className="mb-6 rounded-md border border-red-400/40 bg-red-500/10 p-4">
              <p className="text-sm text-red-800">{validationError ?? authError}</p>
            </div>
          )}

          {step === LoginStep.CREDENTIALS && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCredentialsSubmit();
              }}
              className="space-y-6"
            >
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-[hsl(var(--color-text))]"
                >
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  className="w-full rounded-md border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-2 text-[hsl(var(--color-text))] placeholder:text-[hsl(var(--color-text-muted))] focus:border-transparent focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                  autoFocus
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[hsl(var(--color-text))]"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  className="w-full rounded-md border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-2 text-[hsl(var(--color-text))] placeholder:text-[hsl(var(--color-text-muted))] focus:border-transparent focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberDevice"
                  checked={rememberDevice}
                  onChange={(e) => {
                    setRememberDevice(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] text-[hsl(var(--color-accent-strong))] focus:ring-[hsl(var(--color-accent-strong))]"
                />
                <label
                  htmlFor="rememberDevice"
                  className="ml-2 block text-sm text-[hsl(var(--color-text-muted))]"
                >
                  Remember this device
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-[hsl(var(--color-accent))] px-4 py-2 text-white transition-colors hover:bg-[hsl(var(--color-accent-strong))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--color-surface-muted))]"
              >
                Sign In
              </button>
            </form>
          )}

          {/* Authenticating */}
          {step === LoginStep.AUTHENTICATING && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-[hsl(var(--color-text-muted))]">
                Authenticating with the NewsBoxOne API...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-[hsl(var(--color-text-muted))]">
          Powered by NewsBoxOne
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginContent />;
}
