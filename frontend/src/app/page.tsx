import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
          RealChat
        </h1>
        <p className="text-2xl text-gray-600 dark:text-gray-300 mb-8">
          Secure. Private. Encrypted.
        </p>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          End-to-end encrypted messaging that keeps your conversations private.
          Your messages are encrypted on your device and can only be read by you and your recipients.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-semibold"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold border border-gray-300 dark:border-gray-600"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2 dark:text-white">
              End-to-End Encrypted
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your messages are encrypted with X25519 key exchange and AES-256-GCM.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">👤</div>
            <h3 className="text-xl font-semibold mb-2 dark:text-white">
              Private Identity
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Connect via secure public IDs. No phone numbers or personal info required.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2 dark:text-white">
              Real-Time Delivery
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Instant message delivery with WebSocket-powered real-time updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
