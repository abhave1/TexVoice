// src/routes/inbound.ts
import { FastifyInstance } from 'fastify';
import { handleInboundCall } from '../controllers/inbound.controller';

/**
 * Register inbound call routes
 * Thin routing layer - delegates to controller
 */
export async function inboundRoutes(fastify: FastifyInstance) {
  // Test endpoint to verify route is working
  fastify.get('/inbound', async (request, reply) => {
    return reply.send({
      status: 'ok',
      message: 'Inbound endpoint is accessible',
      timestamp: new Date().toISOString()
    });
  });

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
                model: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string' },
                    model: { type: 'string' },
                    temperature: { type: 'number' },
                    toolIds: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    messages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          role: { type: 'string' },
                          content: { type: 'string' }
                        },
                        required: ['role', 'content']
                      }
                    }
                  },
                  required: ['provider', 'model', 'messages']
                },
                voice: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string' },
                    voiceId: { type: 'string' },
                    stability: { type: 'number' },
                    similarityBoost: { type: 'number' },
                    optimizeStreamingLatency: { type: 'number' },
                    useSpeakerBoost: { type: 'boolean' }
                  }
                },
                firstMessage: { type: 'string' }
              },
              required: ['model', 'firstMessage']
            }
          },
          required: ['assistant']
        }
      }
    }
  }, handleInboundCall);
}
