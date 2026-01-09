import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'RealChat - Secure E2EE Messaging',
  description: 'End-to-end encrypted messaging platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
