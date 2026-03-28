import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLoginFlow, LoginStep } from '@/hooks/useLoginFlow';
import * as loginLib from '@/lib/auth/login';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLogin = vi.fn();
let mockAuthError: string | null = null;
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, error: mockAuthError }),
}));

vi.mock('@/lib/auth/login');

const mockedValidateLoginCredentials = vi.mocked(loginLib.validateLoginCredentials);

describe('useLoginFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthError = null;
  });

  it('starts at the CREDENTIALS step', () => {
    const { result } = renderHook(() => useLoginFlow());
    expect(result.current.step).toBe(LoginStep.CREDENTIALS);
  });

  it('navigates to /timeline on successful login', async () => {
    mockedValidateLoginCredentials.mockReturnValue(undefined);
    mockLogin.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLoginFlow());
    act(() => {
      result.current.setUsername('user');
      result.current.setPassword('pass');
      result.current.setRememberDevice(true);
    });

    await act(async () => {
      await result.current.handleCredentialsSubmit();
    });

    expect(mockLogin).toHaveBeenCalledWith('user', 'pass', true);
    expect(mockPush).toHaveBeenCalledWith('/timeline');
  });

  it('sets AUTHENTICATING while login is pending', async () => {
    mockedValidateLoginCredentials.mockReturnValue(undefined);
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );

    const { result } = renderHook(() => useLoginFlow());
    act(() => {
      result.current.setUsername('user');
      result.current.setPassword('pass');
      void result.current.handleCredentialsSubmit();
    });

    expect(result.current.step).toBe(LoginStep.AUTHENTICATING);

    await act(async () => {
      resolveLogin();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith('/timeline');
  });

  it('returns to CREDENTIALS and sets error when login fails', async () => {
    mockedValidateLoginCredentials.mockReturnValue(undefined);
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useLoginFlow());
    act(() => {
      result.current.setUsername('user');
      result.current.setPassword('bad');
    });

    await act(async () => {
      await result.current.handleCredentialsSubmit();
    });

    expect(result.current.step).toBe(LoginStep.CREDENTIALS);
    expect(result.current.validationError).toBe('Invalid credentials');
  });

  it('stays at CREDENTIALS when local validation fails', async () => {
    mockedValidateLoginCredentials.mockImplementation(() => {
      throw new Error('Password is required');
    });

    const { result } = renderHook(() => useLoginFlow());
    act(() => {
      result.current.setUsername('user');
    });

    await act(async () => {
      await result.current.handleCredentialsSubmit();
    });

    expect(result.current.step).toBe(LoginStep.CREDENTIALS);
    expect(result.current.validationError).toBe('Password is required');
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
