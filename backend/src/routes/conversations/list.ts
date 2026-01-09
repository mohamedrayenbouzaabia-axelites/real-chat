import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';

export async function listConversationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = (request.user as any)?.userId;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User not authenticated',
    });
  }

  try {
    // Get user's conversations with participant details
    const result = await db.query(
      `SELECT DISTINCT
        c.id,
        c.is_direct,
        c.name,
        c.created_at,
        c.updated_at,
        cp.last_read_at,
        u.id as other_user_id,
        u.username as other_username,
        u.public_id as other_public_id
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       INNER JOIN users u ON cp2.user_id = u.id
       WHERE cp.user_id = $1
       AND cp2.user_id != $1
       AND cp.left_at IS NULL
       AND cp2.left_at IS NULL
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    return reply.status(200).send({
      conversations: result.rows,
    });
  } catch (error) {
    request.log.error(error, 'Failed to list conversations');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversations',
    });
  }
}
