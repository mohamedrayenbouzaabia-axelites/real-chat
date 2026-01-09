'use client';

/**
 * Simple JWT Authentication Provider
 * Provides authentication context without Keycloak
 */

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import {
  getUserInfo,
  getAccessToken,
  isAuthenticated as checkIsAuthenticated,
  logout as authLogout,
  updateToken,
  type AuthUser,
} from '@/lib/keycloak';

interface AuthContextType {
  authenticated: boolean;
  initialized: boolean;
  user: AuthUser | null;
  token: string | undefined;
  logout: () => void;
  login: (username: string, password: string) => Promise<AuthUser>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component - provides JWT-based auth context
 */
export default function AuthProvider({ children }: AuthProviderProps) {
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [authenticated, setAuthenticated] = useState(false);

  // Function to update auth state from localStorage
  const updateAuthState = () => {
    const isAuthenticated = checkIsAuthenticated();
    const accessToken = getAccessToken();
    const userInfo = getUserInfo();

    setAuthenticated(isAuthenticated);
    setToken(accessToken);
    setUser(userInfo);
  };

  // Initialize auth state from localStorage
  useEffect(() => {
    updateAuthState();
    setInitialized(true);
  }, []);

  // Listen for storage events (when localStorage changes in other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token' || e.key === 'refresh_token' || e.key === 'user') {
        updateAuthState();
      }
    };

    // Listen for custom auth events (from same tab)
    const handleAuthChange = () => {
      updateAuthState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // Auto-refresh token periodically
  useEffect(() => {
    if (!authenticated) return;

    const refreshInterval = setInterval(async () => {
      const success = await updateToken();
      if (success) {
        setToken(getAccessToken());
        setUser(getUserInfo());
      } else {
        // Token refresh failed, logout
        handleLogout();
      }
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [authenticated]);

  /**
   * Login with username and password
   */
  const login = async (username: string, password: string): Promise<AuthUser> => {
    const { login: authLogin } = require('@/lib/keycloak');
    const user = await authLogin(username, password);

    // Update auth state after successful login
    updateAuthState();

    return user;
  };

  /**
   * Logout and clear auth state
   */
  const handleLogout = () => {
    authLogout();
    setAuthenticated(false);
    setToken(undefined);
    setUser(null);
  };

  /**
   * Refresh access token
   */
  const handleRefreshToken = async (): Promise<boolean> => {
    const success = await updateToken();
    if (success) {
      setToken(getAccessToken());
      setUser(getUserInfo());
    }
    return success;
  };

  const contextValue: AuthContextType = {
    authenticated,
    initialized,
    user,
    token,
    login,
    logout: handleLogout,
    refreshToken: handleRefreshToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
