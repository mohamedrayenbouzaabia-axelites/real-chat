import { z } from 'zod';

/**
 * Send message schema
 */
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  encryptedContent: z.object({
    ciphertext: z.string().min(1, 'Ciphertext is required'),
    nonce: z.string().length(24, 'Nonce must be 24 characters (Base64 encoded 12 bytes)'),
  }),
  messageType: z.enum(['text', 'image', 'file', 'audio', 'video']).default('text'),
  replyToId: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Edit message schema
 */
export const editMessageSchema = z.object({
  encryptedContent: z.object({
    ciphertext: z.string().min(1, 'Ciphertext is required'),
    nonce: z.string().length(24, 'Nonce must be 24 characters'),
  }),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;

/**
 * React to message schema
 */
export const reactToMessageSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required').max(100, 'Emoji too long'),
});

export type ReactToMessageInput = z.infer<typeof reactToMessageSchema>;

/**
 * Message query schema
 */
export const messageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
});

export type MessageQueryInput = z.infer<typeof messageQuerySchema>;
