// src/routes/client.ts
import { FastifyInstance } from 'fastify';
import {
  handleLogin,
  getClientConfig,
  saveClientConfig,
  syncClientConfig,
  getVapiPhoneNumbers,
  getClientCalls,
  getClientCallbacks
} from '../controllers/client.controller';

export async function clientRoutes(fastify: FastifyInstance) {
  // Login endpoint (public)
  fastify.post('/login', handleLogin);

  // Get client configuration (authenticated)
  fastify.get('/config', getClientConfig);

  // Save client configuration (authenticated)
  fastify.post('/config', saveClientConfig);

  // Sync configuration with Vapi (authenticated)
  fastify.post('/sync', syncClientConfig);

  // Get available Vapi phone numbers (authenticated)
  fastify.get('/phone-numbers', getVapiPhoneNumbers);

  // Get calls for this client (authenticated)
  fastify.get('/calls', getClientCalls);

  // Get callbacks for this client (authenticated)
  fastify.get('/callbacks', getClientCallbacks);
}
