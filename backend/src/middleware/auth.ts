import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '@/lib/auth/jwt.js';
import { rateLimiter } from '@/redis/rateLimit.js';
import { env } from '@/config/env.js';

// Extend Fastify request type to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
}

/**
 * Authentication middleware for HTTP routes
 * Verifies JWT token and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = jwtService.verifyAccessToken(token);

    // Attach user to request
    request.user = {
      userId: payload.userId,
      username: payload.username,
    };
  } catch (error) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid token',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwtService.verifyAccessToken(token);

      request.user = {
        userId: payload.userId,
        username: payload.username,
      };
    }
  } catch (error) {
    // Continue without authentication
  }
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const identifier = request.user?.userId || request.ip;
    const action = `${request.routerPath}:${request.method}`;

    await rateLimiter.enforceRateLimit(
      identifier,
      action,
      env.RATE_LIMIT_MAX,
      Math.floor(env.RATE_LIMIT_WINDOW / 1000) // Convert ms to seconds
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'RateLimitError') {
      return reply.status(429).send({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: 60, // Suggest retry after 60 seconds
      });
    }
  }
}

/**
 * WebSocket authentication
 * Extracts and verifies token from query parameters
 */
export async function wsAuthenticate(token: string): Promise<AuthenticatedUser> {
  try {
    const payload = jwtService.verifyAccessToken(token);
    return {
      userId: payload.userId,
      username: payload.username,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
