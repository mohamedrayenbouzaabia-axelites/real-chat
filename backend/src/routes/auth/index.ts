import type { FastifyInstance } from 'fastify';
import { registerHandler } from './register.js';
import { loginHandler } from './login.js';
import { refreshTokenHandler } from './refresh.js';
import { authMiddleware } from '@/middleware/auth.js';
import {
  keycloakCallbackHandler,
  keycloakRefreshHandler,
  keycloakLogoutHandler,
} from './keycloak.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Public routes

  // Register new user
  fastify.post('/register', {
    handler: registerHandler,
  });

  // Login
  fastify.post('/login', {
    handler: loginHandler,
  });

  // Refresh access token
  fastify.post('/refresh', {
    handler: refreshTokenHandler,
  });

  // Keycloak OAuth2 callback
  fastify.get('/keycloak/callback', {
    handler: keycloakCallbackHandler,
  });

  // Keycloak token refresh
  fastify.post('/keycloak/refresh', {
    handler: keycloakRefreshHandler,
  });

  // Keycloak logout
  fastify.post('/keycloak/logout', {
    handler: keycloakLogoutHandler,
  });

  // Protected routes

  // Logout (optional - just client-side token deletion)
  fastify.post('/logout', {
    onRequest: [authMiddleware],
    handler: async (request, reply) => {
      // Token deletion is handled client-side
      // Server-side: could implement token blacklist if needed
      return { message: 'Logged out successfully' };
    },
  });

  // Get current user info
  fastify.get('/me', {
    onRequest: [authMiddleware],
    handler: async (request, reply) => {
      const userId = (request.user as any)?.userId;

      // Fetch full user info from database
      const { db } = await import('@/database/connection.js');
      const result = await db.query(
        'SELECT id, username, email, public_id, email_verified, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'User not found',
        });
      }

      const user = result.rows[0];

      return {
        user: {
          id: user.id,
          userId: user.id,
          username: user.username,
          email: user.email,
          publicId: user.public_id,
          emailVerified: user.email_verified,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      };
    },
  });
}
