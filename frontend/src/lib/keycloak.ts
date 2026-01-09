/**
 * Simple JWT-based authentication utilities
 * Replaces Keycloak OAuth2/OIDC authentication
 */

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
};

/**
 * Get current access token from localStorage
 */
export const getAccessToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || undefined;
};

/**
 * Get current refresh token from localStorage
 */
export const getRefreshToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || undefined;
};

/**
 * Get current user info from localStorage
 */
export const getUserInfo = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

/**
 * Store authentication tokens
 */
export const setTokens = (tokens: AuthTokens) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  }
};

/**
 * Store user info
 */
export const setUserInfo = (user: AuthUser) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

/**
 * Login - stores tokens and user info
 */
export const login = async (username: string, password: string): Promise<AuthUser> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();

  // Store tokens
  setTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  // Store user info
  const user: AuthUser = {
    userId: data.user.id,
    username: data.user.username,
    email: data.user.email,
    emailVerified: data.user.emailVerified,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
  };
  setUserInfo(user);

  return user;
};

/**
 * Logout - clears all auth data
 */
export const logout = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
};

/**
 * Refresh access token
 */
export const updateToken = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
    });

    return true;
  } catch {
    return false;
  }
};

/**
 * Get authorization header for API requests
 */
export const getAuthHeader = (): { Authorization: string } | {} => {
  const token = getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};
