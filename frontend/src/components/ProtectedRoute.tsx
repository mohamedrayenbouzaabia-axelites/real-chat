'use client';

/**
 * ProtectedRoute component
 * Wraps routes that require authentication
 * Redirects to login if user is not authenticated
 */

import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute wrapper - ensures user is authenticated before rendering children
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authenticated, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) {
      // Still initializing, wait
      return;
    }

    if (!authenticated) {
      // Not authenticated, redirect to home/login page
      console.log('Not authenticated, redirecting to home...');
      router.push('/');
      return;
    }
  }, [authenticated, initialized, router]);

  // Show loading while initializing
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!authenticated) {
    return null;
  }

  // Render children if authenticated
  return <>{children}</>;
}
