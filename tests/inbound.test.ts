import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import formBody from '@fastify/formbody';
import cors from '@fastify/cors';
import { inboundRoutes } from '../src/routes/inbound';

describe('Inbound Route - Customer Recognition', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(formBody);
    await app.register(inboundRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Known Customer', () => {
    it('should recognize Abhave and return personalized greeting', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            type: "inbound-call",
            call: {
              customer: {
                number: "+14805551234"
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.assistant).toBeDefined();
      expect(body.assistant.model.provider).toBe("groq");
      expect(body.assistant.model.model).toBe("llama-3.1-8b-instant");
      expect(body.assistant.firstMessage).toContain("Hi Abhave");
      expect(body.assistant.firstMessage).toContain("Tex Intel");
      expect(body.assistant.firstMessage).toContain("Cat 336 Excavator");

      // Check system prompt includes context
      const systemMessage = body.assistant.model.messages[0];
      expect(systemMessage.role).toBe("system");
      expect(systemMessage.content).toContain("Abhave");
      expect(systemMessage.content).toContain("Tex Intel HQ");
      expect(systemMessage.content).toContain("Cat 336 Excavator");
    });

    it('should recognize Bob Builder and return personalized greeting', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            type: "inbound-call",
            call: {
              customer: {
                number: "+15125559999"
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.assistant.firstMessage).toContain("Bob Builder");
      expect(body.assistant.firstMessage).toContain("Skid Steer");
    });

    it('should recognize Sarah Martinez', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            type: "inbound-call",
            call: {
              customer: {
                number: "+14695558888"
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.assistant.firstMessage).toContain("Sarah");
      expect(body.assistant.firstMessage).toContain("Cat D6 Dozer");
    });
  });

  describe('Unknown Customer', () => {
    it('should return generic greeting for unknown number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            type: "inbound-call",
            call: {
              customer: {
                number: "+19999999999"
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.assistant.firstMessage).toBe("Thanks for calling Tex Intel. How can I help you?");

      // System prompt should NOT contain customer context
      const systemMessage = body.assistant.model.messages[0];
      expect(systemMessage.content).not.toContain("CONTEXT:");
      expect(systemMessage.content).toContain("Tex Intel");
      expect(systemMessage.content).toContain("check_inventory");
    });

    it('should handle different unknown number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            type: "inbound-call",
            call: {
              customer: {
                number: "+11234567890"
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.assistant.firstMessage).toBe("Thanks for calling Tex Intel. How can I help you?");
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing phone number gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            type: "inbound-call",
            call: {}
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Should return generic greeting when no number provided
      expect(body.assistant.firstMessage).toBe("Thanks for calling Tex Intel. How can I help you?");
    });

    it('should always return Groq model configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inbound',
        payload: {
          message: {
            call: {
              customer: {
                number: "+19999999999"
              }
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.assistant.model.provider).toBe("groq");
      expect(body.assistant.model.model).toBe("llama-3.1-8b-instant");
      expect(body.assistant.model.messages).toHaveLength(1);
      expect(body.assistant.model.messages[0].role).toBe("system");
    });
  });
});
