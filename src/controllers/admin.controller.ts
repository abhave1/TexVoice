import { FastifyRequest, FastifyReply } from 'fastify';
import { vapiClient } from '../services/vapi-client.service';
import { databaseService } from '../services/database.service';

export class AdminController {
  async getCalls(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { limit = '50', createdAtGt, createdAtLt } = request.query as any;

      const calls = await vapiClient.listCalls({
        limit: parseInt(limit),
        ...(createdAtGt && { createdAtGt }),
        ...(createdAtLt && { createdAtLt })
      });

      return reply.send(calls);
    } catch (error: any) {
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

      const call = await vapiClient.getCall(callId);

      return reply.send(call);
    } catch (error: any) {
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
      return reply.status(500).send({ error: error.message });
    }
  }

  // Billing Routes 

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
      return reply.status(500).send({ error: error.message });
    }
  }

  // Tools Routes 

  /**
   * GET /admin/tools
   * List all tools in Vapi
   */
  async getTools(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tools = await vapiClient.listTools();
      return reply.send(tools);
    } catch (error: any) {
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

  // ==================== LOCAL DATABASE ENDPOINTS ====================

  /**
   * GET /admin/db/calls
   * Get calls from local database (with structured data)
   */
  async getLocalCalls(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { limit = '50' } = request.query as any;
      const calls = await databaseService.getRecentCalls(parseInt(limit));

      return reply.send({
        count: calls.length,
        calls
      });
    } catch (error: any) {
      console.error('[Admin] Failed to fetch local calls:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * GET /admin/db/calls/:callId
   * Get specific call from local database
   */
  async getLocalCall(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { callId } = request.params as { callId: string };
      const call = await databaseService.getCall(callId);

      if (!call) {
        return reply.status(404).send({ error: 'Call not found in local database' });
      }

      return reply.send(call);
    } catch (error: any) {
      console.error('[Admin] Failed to fetch local call:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * GET /admin/db/stats/daily
   * Get daily statistics from local database
   */
  async getDailyStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { days = '7' } = request.query as any;
      const stats = await databaseService.getDailyStats(parseInt(days));

      return reply.send({
        days: parseInt(days),
        stats
      });
    } catch (error: any) {
      console.error('[Admin] Failed to fetch daily stats:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }

  /**
   * GET /admin/db/stats/intents
   * Get intent breakdown analytics
   */
  async getIntentStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const breakdown = await databaseService.getIntentBreakdown();

      return reply.send({
        count: breakdown.length,
        intents: breakdown
      });
    } catch (error: any) {
      console.error('[Admin] Failed to fetch intent stats:', error.message);
      return reply.status(500).send({ error: error.message });
    }
  }
}
