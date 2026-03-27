/**
 * Validates the username/password fields entered during login.
 */
export function validateLoginCredentials(username: string, password: string): void {
  if (!username.trim()) {
    throw new Error('Username is required');
  }

  if (!password) {
    throw new Error('Password is required');
  }
}
