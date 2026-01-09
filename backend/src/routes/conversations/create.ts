import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';

interface CreateConversationBody {
  identifier: string; // Can be public ID, username, or email
}

export async function createConversationHandler(
  request: FastifyRequest<{ Body: CreateConversationBody }>,
  reply: FastifyReply
) {
  const userId = (request.user as any)?.userId;
  const { identifier } = request.body;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User not authenticated',
    });
  }

  if (!identifier || identifier.trim().length === 0) {
    return reply.status(400).send({
      error: 'Invalid Input',
      message: 'Please enter a public ID, username, or email',
    });
  }

  // Normalize identifier (trim and uppercase for public IDs)
  const normalizedIdentifier = identifier.trim().toUpperCase();

  try {
    // Check if it's a public ID format (XXXX-XXXX-XXXX-XXXX)
    const isPublicId = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedIdentifier);

    // Find the other user by public_id, username, or email
    let otherUserResult;

    if (isPublicId) {
      // Search by public ID
      otherUserResult = await db.query(
        'SELECT id, username, email, public_id FROM users WHERE public_id = $1',
        [normalizedIdentifier]
      );
    } else {
      // Search by username or email
      otherUserResult = await db.query(
        'SELECT id, username, email, public_id FROM users WHERE username = $1 OR email = $2',
        [normalizedIdentifier.toLowerCase(), identifier.toLowerCase()]
      );
    }

    if (otherUserResult.rows.length === 0) {
      return reply.status(404).send({
        error: 'User Not Found',
        message: `No user found with: ${identifier}`,
      });
    }

    const otherUser = otherUserResult.rows[0];
    const otherUserId = otherUser.id;

    // Check if user is trying to start conversation with themselves
    if (otherUserId === userId) {
      return reply.status(400).send({
        error: 'Invalid Conversation',
        message: 'Cannot start conversation with yourself',
      });
    }

    // Check if conversation already exists between these two users
    const existingConversationResult = await db.query(
      `SELECT c.id
       FROM conversations c
       INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE c.is_direct = true
       AND cp1.user_id = $1
       AND cp2.user_id = $2
       AND cp1.left_at IS NULL
       AND cp2.left_at IS NULL`,
      [userId, otherUserId]
    );

    if (existingConversationResult.rows.length > 0) {
      // Conversation already exists, return it
      return reply.status(200).send({
        conversation: {
          id: existingConversationResult.rows[0].id,
          is_direct: true,
        },
        user: {
          id: otherUser.id,
          username: otherUser.username,
          publicId: otherUser.public_id,
        },
        message: 'Conversation already exists',
      });
    }

    // Create new conversation
    const conversationResult = await db.query(
      `INSERT INTO conversations (is_direct, is_encrypted, created_by)
       VALUES (true, true, $1)
       RETURNING id, is_direct, created_at`,
      [userId]
    );

    const conversationId = conversationResult.rows[0].id;

    // Add both users as participants
    await db.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role)
       VALUES ($1, $2, 'admin'), ($1, $3, 'admin')`,
      [conversationId, userId, otherUserId]
    );

    return reply.status(201).send({
      conversation: {
        id: conversationId,
        is_direct: conversationResult.rows[0].is_direct,
        created_at: conversationResult.rows[0].created_at,
      },
      user: {
        id: otherUser.id,
        username: otherUser.username,
        publicId: otherUser.public_id,
      },
      message: 'Conversation created successfully',
    });
  } catch (error) {
    request.log.error(error, 'Failed to create conversation');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create conversation',
    });
  }
}
