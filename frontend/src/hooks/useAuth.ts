'use client';

/**
 * Custom hook for accessing JWT authentication
 * Replaces Keycloak-based authentication hook
 */

import { useAuthContext } from '@/providers/AuthProvider';
import { getAuthHeader } from '@/lib/keycloak';

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
}

/**
 * useAuth hook - provides authentication state and functions
 */
export const useAuth = () => {
  const { authenticated, initialized, user, token, login, logout, refreshToken } = useAuthContext();

  /**
   * Get authorization header for API requests
   */
  const getAuthHeader = (): { Authorization: string } | {} => {
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  };

  return {
    // Authentication state
    authenticated,
    initialized,
    user,
    token,

    // Authentication functions
    login,
    logout,
    refreshToken,

    // Helper functions
    getAuthHeader,
  };
};
