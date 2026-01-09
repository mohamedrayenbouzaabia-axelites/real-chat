import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';
import { passwordService } from '@/lib/auth/password.js';
import { jwtService } from '@/lib/auth/jwt.js';
import { loginSchema, type LoginInput } from '@/schemas/auth.js';
import { validateBody } from '@/middleware/validation.js';

/**
 * User login handler
 */
export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Validate input
  const validation = await validateBody(loginSchema)(request, reply);
  if (!validation) {
    return; // Validation error already sent
  }

  const body = request.body as LoginInput;

  try {
    // Find user by username or email
    const result = await db.query(
      `SELECT id, username, email, password_hash, public_id,
              email_verified, first_name, last_name
       FROM users
       WHERE username = $1 OR email = $1
       AND is_active = true`,
      [body.identifier]
    );

    if (result.rowCount === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await passwordService.verify(
      user.password_hash,
      body.password
    );

    if (!isValid) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    // Update last seen
    await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [
      user.id,
    ]);

    // Generate tokens
    const tokens = jwtService.generateTokenPair({
      userId: user.id,
      username: user.username,
    });

    // Return user data and tokens
    return reply.status(200).send({
      user: {
        id: user.id,
        userId: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified,
        firstName: user.first_name,
        lastName: user.last_name,
        publicId: user.public_id,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Failed to login',
    });
  }
}
