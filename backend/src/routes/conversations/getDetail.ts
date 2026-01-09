import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';

export async function getConversationDetailHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request.user as any)?.userId;
  const conversationId = request.params.id;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User not authenticated',
    });
  }

  try {
    // Check if user is participant of this conversation
    const participantCheck = await db.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL',
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Conversation not found or access denied',
      });
    }

    // Get conversation details with other participant info
    const result = await db.query(
      `SELECT
        c.id,
        c.is_direct,
        c.name,
        c.created_at,
        c.updated_at,
        u.id as other_user_id,
        u.username as other_username,
        u.public_id as other_public_id
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       INNER JOIN users u ON cp2.user_id = u.id
       WHERE c.id = $1
       AND cp.user_id = $2
       AND cp2.user_id != $2
       AND cp.left_at IS NULL
       AND cp2.left_at IS NULL`,
      [conversationId, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Conversation not found',
      });
    }

    return reply.status(200).send({
      conversation: result.rows[0],
    });
  } catch (error) {
    request.log.error(error, 'Failed to get conversation detail');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversation',
    });
  }
}
