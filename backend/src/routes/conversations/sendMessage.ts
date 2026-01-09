import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';
import { wsManager } from '@/websocket/manager.js';

interface SendMessageBody {
  content: string;
  messageType?: string;
  replyToId?: string;
}

export async function sendMessageHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: SendMessageBody }>,
  reply: FastifyReply
) {
  const userId = (request.user as any)?.userId;
  const conversationId = request.params.id;
  const { content, messageType = 'text', replyToId } = request.body;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User not authenticated',
    });
  }

  if (!content || content.trim().length === 0) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Message content is required',
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

    // If replyToId is provided, verify the message exists and is in the same conversation
    if (replyToId) {
      const replyCheck = await db.query(
        'SELECT id, sender_id, encrypted_content FROM messages WHERE id = $1 AND conversation_id = $2',
        [replyToId, conversationId]
      );

      if (replyCheck.rows.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Reply to message not found in this conversation',
        });
      }
    }

    // For now, we'll store a placeholder encrypted content
    // TODO: Implement actual E2EE encryption on the client side
    const encryptedContent = {
      ciphertext: content, // This should be encrypted on the client
      nonce: 'placeholder-nonce',
    };

    // Insert message with reply_to_id if provided (pg-pool automatically handles JSONB)
    const result = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, encrypted_content, message_type, reply_to_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, conversation_id, sender_id, encrypted_content, message_type, reply_to_id, created_at`,
      [conversationId, userId, encryptedContent, messageType, replyToId || null]
    );

    const newMessage = result.rows[0];

    // Broadcast to WebSocket subscribers
    console.log(`Broadcasting message to conversation ${conversationId}`);
    wsManager.broadcastNewMessage(conversationId, newMessage);

    return reply.status(201).send({
      message: newMessage,
    });
  } catch (error) {
    request.log.error(error, 'Failed to send message');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to send message',
    });
  }
}
