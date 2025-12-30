import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import formBody from '@fastify/formbody';
import cors from '@fastify/cors';
import { inboundRoutes } from '../src/routes/inbound';
import { toolRoutes } from '../src/routes/tools';

describe('Health Check Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(formBody);
    await app.register(inboundRoutes);
    await app.register(toolRoutes);

    // Health check endpoint
    app.get('/', async () => {
      return {
        status: "Tex Intel System Operational",
        timestamp: new Date().toISOString(),
        endpoints: {
          inbound: "/inbound",
          tools: "/tools"
        }
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return operational status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("Tex Intel System Operational");
    expect(body.endpoints).toEqual({
      inbound: "/inbound",
      tools: "/tools"
    });
    expect(body.timestamp).toBeDefined();
  });

  it('should return valid timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    const body = JSON.parse(response.body);
    const timestamp = new Date(body.timestamp);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });
});
