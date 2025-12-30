// src/controllers/admin.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { vapiClient } from '../services/vapi-client.service';
import { VAPI_TOOLS } from '../config/vapi-config';

/**
 * Admin Controller
 * Handles all admin endpoints for Vapi management and analytics
 */
export class AdminController {

  // ==================== CALL LOGS ====================

  /**
   * GET /admin/calls
   * Fetch call logs from Vapi
   */
  async getCalls(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { limit = '50', createdAtGt, createdAtLt } = request.query as any;
      console.log(`[Admin] Fetching calls - limit: ${limit}`);

      const calls = await vapiClient.listCalls({
        limit: parseInt(limit),
        ...(createdAtGt && { createdAtGt }),
        ...(createdAtLt && { createdAtLt })
      });

      console.log(`[Admin] Retrieved ${calls.results?.length || 0} calls`);
      return reply.send(calls);
    } catch (error: any) {
      console.error('[Admin] Failed to fetch calls:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * GET /admin/calls/:callId
   * Get specific call details including transcript
   */
  async getCall(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { callId } = request.params as { callId: string };
      console.log(`[Admin] Fetching call details for: ${callId}`);

      const call = await vapiClient.getCall(callId);
      console.log(`[Admin] Retrieved call ${callId} - Status: ${call.status}, Duration: ${call.endedAt ? 'ended' : 'active'}`);

      return reply.send(call);
    } catch (error: any) {
      console.error(`[Admin] Failed to fetch call:`, error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * GET /admin/calls/:callId/transcript
   * Get call transcript only
   */
  async getCallTranscript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { callId } = request.params as { callId: string };
      const transcript = await vapiClient.getCallTranscript(callId);

      return reply.send({ callId, transcript });
    } catch (error: any) {
      console.error('[Admin] Failed to fetch transcript:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  // ==================== BILLING ====================

  /**
   * GET /admin/billing
   * Get billing/cost data for calls
   */
  async getBilling(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { startDate, endDate, limit = '100' } = request.query as any;

      const costData = await vapiClient.getCallCosts({
        limit: parseInt(limit),
        ...(startDate && { createdAtGt: startDate }),
        ...(endDate && { createdAtLt: endDate })
      });

      return reply.send({
        totalCost: costData.totalCost,
        callCount: costData.calls.length,
        calls: costData.calls.map(call => ({
          id: call.id,
          createdAt: call.createdAt,
          duration: call.endedAt && call.startedAt
            ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
            : null,
          cost: call.cost,
          costBreakdown: call.costBreakdown
        }))
      });
    } catch (error: any) {
      console.error('[Admin] Failed to fetch billing:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  // ==================== TOOLS MANAGEMENT ====================

  /**
   * GET /admin/tools
   * List all tools in Vapi
   */
  async getTools(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tools = await vapiClient.listTools();
      return reply.send(tools);
    } catch (error: any) {
      console.error('[Admin] Failed to fetch tools:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * POST /admin/tools/sync
   * Sync local tool definitions to Vapi
   */
  async syncTools(request: FastifyRequest, reply: FastifyReply) {
    try {
      console.log(`[Admin] Starting tool sync - ${VAPI_TOOLS.length} tools to sync`);
      const results = [];

      // Fetch existing tools once (not in loop!)
      const existingTools = await vapiClient.listTools();
      console.log(`[Admin] Found ${existingTools.results.length} existing tools in Vapi`);

      for (const tool of VAPI_TOOLS) {
        const existing = existingTools.results.find(
          t => t.function.name === tool.function.name
        );

        if (existing && existing.id) {
          // Update existing tool
          console.log(`[Admin] Updating tool: ${tool.function.name}`);
          const updated = await vapiClient.updateTool(existing.id, tool);
          results.push({ action: 'updated', tool: updated });
        } else {
          // Create new tool
          console.log(`[Admin] Creating new tool: ${tool.function.name}`);
          const created = await vapiClient.createTool(tool);
          results.push({ action: 'created', tool: created });
        }
      }

      console.log(`[Admin] Tool sync complete - Created: ${results.filter(r => r.action === 'created').length}, Updated: ${results.filter(r => r.action === 'updated').length}`);
      return reply.send({
        success: true,
        synced: results.length,
        results
      });
    } catch (error: any) {
      console.error('[Admin] Tool sync failed:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  // ==================== ASSISTANTS MANAGEMENT ====================

  /**
   * GET /admin/assistants
   * List all assistants
   */
  async getAssistants(request: FastifyRequest, reply: FastifyReply) {
    try {
      const assistants = await vapiClient.listAssistants();
      return reply.send(assistants);
    } catch (error: any) {
      console.error('[Admin] Failed to fetch assistants:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * PATCH /admin/assistants/:assistantId
   * Update assistant configuration
   */
  async updateAssistant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { assistantId } = request.params as { assistantId: string };
      const updates = request.body as any;

      const updated = await vapiClient.updateAssistant(assistantId, updates);

      return reply.send(updated);
    } catch (error: any) {
      console.error('[Admin] Failed to update assistant:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  // ==================== PHONE NUMBERS ====================

  /**
   * GET /admin/phone-numbers
   * List all phone numbers
   */
  async getPhoneNumbers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const phoneNumbers = await vapiClient.listPhoneNumbers();
      return reply.send(phoneNumbers);
    } catch (error: any) {
      console.error('[Admin] Failed to fetch phone numbers:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * GET /admin/health
   * Check if Vapi API is accessible
   */
  async getHealth(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Try to list calls as a health check
      await vapiClient.listCalls({ limit: 1 });

      return reply.send({
        status: 'ok',
        vapiApiConnected: true,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return reply.status(503).send({
        status: 'error',
        vapiApiConnected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}
