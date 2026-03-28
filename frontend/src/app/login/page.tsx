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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to NewsBoxOne</h1>
            <p className="text-gray-600">
              {step === LoginStep.CREDENTIALS && 'Sign in to your NewsBoxOne reader'}
              {step === LoginStep.AUTHENTICATING && 'Verifying credentials...'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8 flex justify-center space-x-2">
            <div
              className={`h-2 w-12 rounded-full ${step >= LoginStep.CREDENTIALS ? 'bg-blue-600' : 'bg-gray-300'}`}
            />
            <div
              className={`h-2 w-12 rounded-full ${step >= LoginStep.AUTHENTICATING ? 'bg-blue-600' : 'bg-gray-300'}`}
            />
          </div>

          {/* Error display */}
          {(validationError ?? authError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
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
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="rememberDevice" className="ml-2 block text-sm text-gray-700">
                  Remember this device
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Sign In
              </button>
            </form>
          )}

          {/* Authenticating */}
          {step === LoginStep.AUTHENTICATING && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Authenticating with the NewsBoxOne API...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600">Powered by NewsBoxOne</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginContent />;
}
