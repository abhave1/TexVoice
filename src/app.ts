// src/app.ts
// IMPORTANT: Load env vars FIRST before any other imports
import 'dotenv/config';
import Fastify from 'fastify';
import formBody from '@fastify/formbody';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import staticFiles from '@fastify/static';
import { join } from 'path';
import { readFileSync } from 'fs';
import { inboundRoutes } from './routes/inbound';
import { toolRoutes } from './routes/tools';
import { adminRoutes } from './routes/admin';

// Initialize Fastify with minimal logging
const fastify = Fastify({
  logger: false,
  disableRequestLogging: true
});

// Register Swagger for API documentation
fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Tex Intel API',
      description: 'Voice AI integration API for heavy equipment rental business',
      version: '1.0.0'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'health', description: 'Health check endpoints' },
      { name: 'vapi', description: 'Vapi webhook endpoints' },
      { name: 'admin', description: 'Admin & analytics endpoints' }
    ]
  }
});

const docsCss = readFileSync(join(__dirname, '../public/docs.css'), 'utf-8');

fastify.register(swaggerUi, {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true
  },
  theme: {
    css: [{ filename: 'docs.css', content: docsCss }]
  },
  transformStaticCSP: (header) => header
});

// Register plugins
fastify.register(cors, {
  origin: true
});

fastify.register(formBody);

// Serve static files (dashboard)
fastify.register(staticFiles, {
  root: join(__dirname, '../public'),
  prefix: '/'
});

// Register routes
fastify.register(inboundRoutes);
fastify.register(toolRoutes);
fastify.register(adminRoutes);

// API health check
fastify.get('/api', {
  schema: {
    tags: ['health'],
    description: 'API health check and endpoints list',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          endpoints: { type: 'object' }
        }
      }
    }
  }
}, async () => {
  return {
    status: "Tex Intel API Operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      dashboard: "/",
      documentation: "/documentation",
      inbound: "/inbound",
      tools: "tools",
      admin: {
        calls: "/admin/calls",
        billing: "/admin/billing",
        tools: "/admin/tools",
        assistants: "/admin/assistants",
        phoneNumbers: "/admin/phone-numbers",
        health: "/admin/health"
      }
    }
  };
});

// Graceful shutdown handler
const closeGracefully = async (signal: string) => {
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    console.log(`🚀 Server running on ${host}:${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
