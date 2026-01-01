// src/routes/admin.ts
import { FastifyInstance } from 'fastify';
import { AdminController } from '../controllers/admin.controller';

const controller = new AdminController();

/**
 * Admin routes for Vapi management and analytics
 * Thin routing layer - delegates to controller
 */
export async function adminRoutes(fastify: FastifyInstance) {

  // Call logs
  fastify.get('/admin/calls', controller.getCalls.bind(controller));
  fastify.get('/admin/calls/:callId', controller.getCall.bind(controller));
  fastify.get('/admin/calls/:callId/transcript', controller.getCallTranscript.bind(controller));

  // Billing
  fastify.get('/admin/billing', controller.getBilling.bind(controller));

  // Tools management
  fastify.get('/admin/tools', controller.getTools.bind(controller));

  // Health check
  fastify.get('/admin/health', controller.getHealth.bind(controller));

  // Local database endpoints (with structured data)
  fastify.get('/admin/db/calls', controller.getLocalCalls.bind(controller));
  fastify.get('/admin/db/calls/:callId', controller.getLocalCall.bind(controller));
  fastify.get('/admin/db/stats/daily', controller.getDailyStats.bind(controller));
  fastify.get('/admin/db/stats/intents', controller.getIntentStats.bind(controller));
}
