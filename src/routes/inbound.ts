// src/routes/inbound.ts
import { FastifyInstance } from 'fastify';
import { handleInboundCall } from '../controllers/inbound.controller';

/**
 * Register inbound call routes
 * Thin routing layer - delegates to controller
 */
export async function inboundRoutes(fastify: FastifyInstance) {
  fastify.post('/inbound', {
    schema: {
      tags: ['vapi'],
      description: 'Handle inbound call webhook from Vapi',
      body: {
        type: 'object',
        properties: {
          message: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              call: {
                type: 'object',
                properties: {
                  customer: {
                    type: 'object',
                    properties: {
                      number: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            assistant: {
              type: 'object',
              properties: {
                model: { type: 'object' },
                firstMessage: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, handleInboundCall);
}
