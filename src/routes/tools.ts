// src/routes/tools.ts
import { FastifyInstance } from 'fastify';
import { handleToolExecution } from '../controllers/tools.controller';

/**
 * Register tool execution routes
 * Thin routing layer - delegates to controller
 */
export async function toolRoutes(fastify: FastifyInstance) {
  fastify.post('/tools', {
    schema: {
      tags: ['vapi'],
      description: 'Execute tool calls from Vapi assistant',
      body: {
        type: 'object',
        properties: {
          message: {
            type: 'object',
            properties: {
              toolCalls: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    function: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        arguments: {
                          oneOf: [
                            { type: 'string' },
                            { type: 'object' }
                          ]
                        }
                      }
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
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  toolCallId: { type: 'string' },
                  result: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, handleToolExecution);
}
