import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import formBody from '@fastify/formbody';
import cors from '@fastify/cors';
import { toolRoutes } from '../src/routes/tools';
import { databaseService } from '../src/services/database.service';

describe('Tools Route - Inventory Checking', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Initialize database with in-memory DB for testing
    process.env.DATABASE_PATH = ':memory:';
    await databaseService.init();

    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(formBody);
    await app.register(toolRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Check Inventory - Excavators', () => {
    it('should return excavator inventory', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-call-123",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "excavator"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.results).toBeDefined();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].toolCallId).toBe("test-call-123");
      expect(body.results[0].result).toContain("Cat 336");
      expect(body.results[0].result).toContain("Cat 320");
      expect(body.results[0].result).toContain("$1200/day");
      expect(body.results[0].result).toContain("$950/day");
    });

    it('should find excavators with different casing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-456",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "EXCAVATOR"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toContain("Cat 336");
    });

    it('should find specific excavator model', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-789",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "336"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toContain("Cat 336");
      expect(body.results[0].result).toContain("2 available");
    });
  });

  describe('Check Inventory - Skid Steers', () => {
    it('should return skid steer inventory', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-skid",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "skid steer"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.results[0].result).toContain("Bobcat T76");
      expect(body.results[0].result).toContain("Bobcat S650");
      expect(body.results[0].result).toContain("5 available");
      expect(body.results[0].result).toContain("4 available");
      expect(body.results[0].result).toContain("$350/day");
      expect(body.results[0].result).toContain("$300/day");
    });
  });

  describe('Check Inventory - Dozers', () => {
    it('should return dozer inventory including unavailable', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-dozer",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "dozer"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should return D6 (0 available) and D8 (1 available)
      expect(body.results[0].result).toContain("Cat D6");
      expect(body.results[0].result).toContain("Cat D8");
    });
  });

  describe('Check Inventory - Other Equipment', () => {
    it('should find loaders', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-loader",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "loader"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toContain("Cat 950M");
      expect(body.results[0].result).toContain("$850/day");
    });

    it('should find cranes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-crane",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "crane"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toContain("Manitowoc");
      expect(body.results[0].result).toContain("$2500/day");
    });

    it('should find dump trucks', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-truck",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "dump truck"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toContain("Volvo");
      expect(body.results[0].result).toContain("3 available");
    });
  });

  describe('Check Inventory - No Results', () => {
    it('should return no results message for non-existent equipment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-none",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "helicopter"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toContain("don't see any helicopter available");
    });

    it('should handle empty query gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-empty",
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: ""
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Empty query might return all or none depending on implementation
      expect(body.results).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing toolCalls', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {}
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("No tool calls found");
    });

    it('should handle unknown function name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: "test-unknown",
              type: "function",
              function: {
                name: "unknown_function",
                arguments: {
                  query: "test"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].result).toBe("Tool not found.");
    });

    it('should preserve toolCallId in response', async () => {
      const customId = "custom-unique-id-12345";
      const response = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: {
          message: {
            toolCalls: [{
              id: customId,
              type: "function",
              function: {
                name: "check_inventory",
                arguments: {
                  query: "excavator"
                }
              }
            }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results[0].toolCallId).toBe(customId);
    });
  });
});
