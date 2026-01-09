'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ConversationsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main conversations page
    router.replace('/conversations/home');
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>
  );
}
