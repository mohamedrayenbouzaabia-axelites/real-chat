import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';
import { jwtService } from '@/lib/auth/jwt.js';
import { refreshTokenSchema, type RefreshTokenInput } from '@/schemas/auth.js';
import { validateBody } from '@/middleware/validation.js';

/**
 * Refresh access token handler
 */
export async function refreshTokenHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Validate input
  const validation = await validateBody(refreshTokenSchema)(request, reply);
  if (!validation) {
    return; // Validation error already sent
  }

  const body = request.body as RefreshTokenInput;

  try {
    // Verify refresh token
    const payload = jwtService.verifyRefreshToken(body.refreshToken);

    // Check if user still exists and is active
    const result = await db.query(
      'SELECT id, username, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rowCount === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User account is inactive',
      });
    }

    // Generate new token pair
    const tokens = jwtService.generateTokenPair({
      userId: user.id,
      username: user.username,
    });

    // Return new tokens
    return reply.status(200).send({
      tokens,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token',
    });
  }
}
