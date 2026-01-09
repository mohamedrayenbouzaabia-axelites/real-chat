import { z } from 'zod';

/**
 * Create conversation schema
 */
export const createConversationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  participantPublicIds: z
    .array(z.string().min(1))
    .min(1, 'At least one participant is required')
    .max(100, 'Maximum 100 participants allowed'),
  isDirect: z.boolean().default(true),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

/**
 * Add participant schema
 */
export const addParticipantSchema = z.object({
  publicId: z.string().min(1, 'Public ID is required'),
});

export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

/**
 * Conversation query schema
 */
export const conversationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;
