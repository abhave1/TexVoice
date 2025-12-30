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
  fastify.post('/admin/tools/sync', controller.syncTools.bind(controller));

  // Assistants management
  fastify.get('/admin/assistants', controller.getAssistants.bind(controller));
  fastify.patch('/admin/assistants/:assistantId', controller.updateAssistant.bind(controller));

  // Phone numbers
  fastify.get('/admin/phone-numbers', controller.getPhoneNumbers.bind(controller));

  // Health check
  fastify.get('/admin/health', controller.getHealth.bind(controller));
}
