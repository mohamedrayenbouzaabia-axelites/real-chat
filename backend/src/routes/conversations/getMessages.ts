import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';

export async function getMessagesHandler(
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
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied',
      });
    }

    // Get messages for this conversation with reply_to and reaction info
    const result = await db.query(
      `SELECT
        m.id,
        m.sender_id,
        m.encrypted_content,
        m.message_type,
        m.reply_to_id,
        m.created_at,
        reply_to.encrypted_content as reply_to_content,
        reply_to.sender_id as reply_to_sender_id,
        COALESCE(
          json_agg(
            json_build_object(
              'emoji', mr.emoji,
              'user_id', mr.user_id
            )
          ) FILTER (WHERE mr.emoji IS NOT NULL),
          '[]'
        ) as reactions
       FROM messages m
       LEFT JOIN messages reply_to ON m.reply_to_id = reply_to.id
       LEFT JOIN message_reactions mr ON m.id = mr.message_id
       WHERE m.conversation_id = $1
       AND m.is_deleted = false
       GROUP BY m.id, reply_to.encrypted_content, reply_to.sender_id
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    return reply.status(200).send({
      messages: result.rows,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get messages');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve messages',
    });
  }
}
