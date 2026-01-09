import { createApp } from './app.js';
import { env } from './config/env.js';

/**
 * Start HTTP server
 */
async function startServer() {
  try {
    const app = await createApp();

    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    console.log(`🚀 HTTP server listening on port ${env.PORT}`);
    console.log(`📖 Health check: http://localhost:${env.PORT}/health`);
    console.log(`🔐 API: http://localhost:${env.PORT}/api`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
