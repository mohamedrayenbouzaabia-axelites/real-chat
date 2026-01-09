/**
 * Main entry point
 * Starts both HTTP and WebSocket servers
 */

import { createApp } from './app.js';
import { registerWebSocketRoutes, startWebSocketServer } from './websocket/server.js';
import { env } from './config/env.js';

async function main() {
  console.log('🚀 Starting RealChat backend...');

  try {
    // Create Fastify app with WebSocket routes
    const httpApp = await createApp();
    await registerWebSocketRoutes(httpApp);

    await httpApp.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    console.log(`\n✅ HTTP server listening on port ${env.PORT}`);
    console.log(`   Health check: http://localhost:${env.PORT}/health`);
    console.log(`   API: http://localhost:${env.PORT}/api`);

    // Start WebSocket server (same port, different path)
    await startWebSocketServer();

    console.log(`\n🎉 All servers started successfully!\n`);
  } catch (error) {
    console.error('❌ Failed to start servers:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main();
