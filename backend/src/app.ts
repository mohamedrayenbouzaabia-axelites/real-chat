import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from '@/config/env.js';
import { authRoutes } from '@/routes/auth/index.js';
import { conversationRoutes } from '@/routes/conversations/index.js';
import { db } from '@/database/connection.js';
import { redis } from './redis/client.js';

/**
 * Create and configure Fastify application
 */
export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
  });

  // Register plugins

  // Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        fontSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    cache: 10000,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    skipOnError: false,
    redis: redis.getClient(),
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error, 'Unhandled error');

    // Handle validation errors
    if (error.validation) {
      reply.status(400).send({
        error: 'Validation Error',
        details: error.validation,
      });
      return;
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      reply.status(429).send({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
      });
      return;
    }

    // Generic error response
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const dbHealth = await db.healthCheck();
    const redisHealth = await redis.healthCheck();

    const healthy = dbHealth && redisHealth;

    reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth ? 'ok' : 'error',
        redis: redisHealth ? 'ok' : 'error',
      },
    });
  });

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(conversationRoutes, { prefix: '/api/conversations' });

  // TODO: Add more route groups
  // await fastify.register(messageRoutes, { prefix: '/api/messages' });

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    console.log('Closing connections...');
    await db.close();
    await redis.close();
  });

  return fastify;
}
