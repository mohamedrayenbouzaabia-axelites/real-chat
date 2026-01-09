import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, ZodSchema } from 'zod';

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a Zod schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate request body
      const validated = schema.parse(request.body);
      request.body = validated;
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          error: 'Validation failed',
          details: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return false;
      }
      throw error;
    }
  };
}

/**
 * Validation middleware for query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = schema.parse(request.query);
      request.query = validated;
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          error: 'Query validation failed',
          details: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return false;
      }
      throw error;
    }
  };
}

/**
 * Validation middleware for route parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = schema.parse(request.params);
      request.params = validated;
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          error: 'Parameter validation failed',
          details: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return false;
      }
      throw error;
    }
  };
}
