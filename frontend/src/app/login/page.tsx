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
    <div className="login-page">
      <div className="login-page__shell">
        <header className="login-page__brand">
          <p className="timeline-header__eyebrow">Private feed reader</p>
          <h1>NewsBoxOne</h1>
          <p>Your reading queue, organized and distraction-free.</p>
        </header>

        <section className="login-page__form-panel" aria-labelledby="login-heading">
          <div className="login-page__heading">
            <h2 id="login-heading">Welcome back</h2>
            <p>
              {step === LoginStep.CREDENTIALS && 'Sign in to your NewsBoxOne reader'}
              {step === LoginStep.AUTHENTICATING && 'Verifying credentials...'}
            </p>
          </div>

          <div className="login-page__progress" aria-hidden="true">
            <div
              className={`h-2 w-12 rounded-full ${step >= LoginStep.CREDENTIALS ? 'bg-[hsl(var(--color-accent-strong))]' : 'bg-[hsl(var(--color-border))]'}`}
            />
            <div
              className={`h-2 w-12 rounded-full ${step >= LoginStep.AUTHENTICATING ? 'bg-[hsl(var(--color-accent-strong))]' : 'bg-[hsl(var(--color-border))]'}`}
            />
          </div>

          {(validationError ?? authError) && (
            <div className="login-page__error">
              <p>{validationError ?? authError}</p>
            </div>
          )}

          {step === LoginStep.CREDENTIALS && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCredentialsSubmit();
              }}
              className="login-page__form"
            >
              <div className="login-page__field">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  autoFocus
                  required
                  autoComplete="username"
                />
              </div>

              <div className="login-page__field">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="login-page__remember">
                <input
                  type="checkbox"
                  id="rememberDevice"
                  checked={rememberDevice}
                  onChange={(e) => {
                    setRememberDevice(e.target.checked);
                  }}
                />
                <label htmlFor="rememberDevice">Remember this device</label>
              </div>

              <button type="submit" className="login-page__submit">
                Sign In
              </button>
            </form>
          )}

          {step === LoginStep.AUTHENTICATING && (
            <div className="login-page__authenticating">
              <div className="article-popout__spinner" />
              <p>Authenticating with the NewsBoxOne API...</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginContent />;
}
