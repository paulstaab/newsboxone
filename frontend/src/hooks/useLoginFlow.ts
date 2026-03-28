'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { validateLoginCredentials } from '@/lib/auth/login';

export enum LoginStep {
  CREDENTIALS = 1,
  AUTHENTICATING = 2,
}

/**
 * Owns the login form state machine.
 */
export function useLoginFlow() {
  const router = useRouter();
  const { login, error } = useAuth();
  const [step, setStep] = useState<LoginStep>(LoginStep.CREDENTIALS);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCredentialsSubmit = useCallback(async () => {
    setValidationError(null);

    try {
      validateLoginCredentials(username, password);
      setStep(LoginStep.AUTHENTICATING);
      await login(username, password, rememberDevice);
      router.push('/timeline');
    } catch (error) {
      setStep(LoginStep.CREDENTIALS);
      setPassword('');
      setValidationError(error instanceof Error ? error.message : 'Authentication failed');
    }
  }, [login, password, rememberDevice, router, username]);

  return {
    step,
    username,
    setUsername,
    password,
    setPassword,
    rememberDevice,
    setRememberDevice,
    validationError,
    authError: error,
    handleCredentialsSubmit,
  };
}
