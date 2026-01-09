import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';
import { wsManager } from '@/websocket/manager.js';

interface ReactMessageBody {
  emoji: string;
}

export async function reactMessageHandler(
  request: FastifyRequest<{
    Params: { id: string; messageId: string };
    Body: ReactMessageBody;
  }>,
  reply: FastifyReply
) {
  const userId = (request.user as any)?.userId;
  const conversationId = request.params.id;
  const messageId = request.params.messageId;
  const { emoji } = request.body;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User not authenticated',
    });
  }

  if (!emoji || emoji.trim().length === 0) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Emoji is required',
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

    // Check if message exists in this conversation
    const messageCheck = await db.query(
      'SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2',
      [messageId, conversationId]
    );

    if (messageCheck.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Message not found',
      });
    }

    // Check if user already reacted with this emoji
    const existingReaction = await db.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, userId, emoji]
    );

    if (existingReaction.rows.length > 0) {
      // Remove the reaction (toggle off)
      await db.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [messageId, userId, emoji]
      );

      // Broadcast reaction update
      wsManager.broadcastNewReaction(conversationId, messageId, {
        emoji,
        userId,
        action: 'removed',
      });

      return reply.status(200).send({
        message: 'Reaction removed',
        action: 'removed',
      });
    } else {
      // Add the reaction
      await db.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [messageId, userId, emoji]
      );

      // Broadcast reaction update
      wsManager.broadcastNewReaction(conversationId, messageId, {
        emoji,
        userId,
        action: 'added',
      });

      return reply.status(201).send({
        message: 'Reaction added',
        action: 'added',
      });
    }
  } catch (error) {
    request.log.error(error, 'Failed to react to message');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to react to message',
    });
  }
}
