import type { FastifyInstance } from 'fastify';
import { createConversationHandler } from './create.js';
import { listConversationsHandler } from './list.js';
import { getConversationDetailHandler } from './getDetail.js';
import { getMessagesHandler } from './getMessages.js';
import { sendMessageHandler } from './sendMessage.js';
import { reactMessageHandler } from './reactMessage.js';
import { authMiddleware } from '@/middleware/auth.js';

export async function conversationRoutes(fastify: FastifyInstance) {
  // All conversation routes require authentication

  // Create a new conversation
  fastify.post('/', {
    onRequest: [authMiddleware],
    handler: createConversationHandler,
    schema: {
      body: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Public ID, username, or email of the user to start conversation with',
          },
        },
      },
    },
  });

  // List user's conversations
  fastify.get('/', {
    onRequest: [authMiddleware],
    handler: listConversationsHandler,
  });

  // Get conversation detail
  fastify.get('/:id', {
    onRequest: [authMiddleware],
    handler: getConversationDetailHandler,
  });

  // Get messages for a conversation
  fastify.get('/:id/messages', {
    onRequest: [authMiddleware],
    handler: getMessagesHandler,
  });

  // Send a message to a conversation
  fastify.post('/:id/messages', {
    onRequest: [authMiddleware],
    handler: sendMessageHandler,
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            description: 'Message content',
          },
          messageType: {
            type: 'string',
            default: 'text',
            description: 'Message type (text, image, file, etc.)',
          },
          replyToId: {
            type: 'string',
            description: 'ID of the message being replied to',
          },
        },
      },
    },
  });

  // React to a message (toggle emoji reaction)
  fastify.post('/:id/messages/:messageId/react', {
    onRequest: [authMiddleware],
    handler: reactMessageHandler,
    schema: {
      body: {
        type: 'object',
        required: ['emoji'],
        properties: {
          emoji: {
            type: 'string',
            description: 'Emoji reaction',
          },
        },
      },
    },
  });
}
