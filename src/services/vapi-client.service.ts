// src/services/vapi-client.service.ts
import { VapiClient as VapiSDK } from '@vapi-ai/server-sdk';
import {
  VapiTool,
  VapiAssistant,
  VapiCall,
  VapiPhoneNumber,
  VapiListResponse,
  VapiQueryParams,
  VapiUsage
} from '../types/vapi.types';

/**
 * Vapi API Client (SDK Wrapper)
 * Wraps the official @vapi-ai/server-sdk with a simpler interface
 */
export class VapiClient {
  private sdk: VapiSDK;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.VAPI_API_KEY || '';

    if (!key) {
      console.warn('[VapiClient] WARNING: No API key provided. Set VAPI_API_KEY environment variable.');
    }

    this.sdk = new VapiSDK({ token: key });
  }

  // ==================== TOOLS ====================

  /**
   * List all tools
   */
  async listTools(params?: VapiQueryParams): Promise<VapiListResponse<VapiTool>> {
    const response = await this.sdk.tools.list(params as any);
    return {
      results: response as any,
      count: Array.isArray(response) ? response.length : 0
    };
  }

  /**
   * Get tool by ID
   */
  async getTool(toolId: string): Promise<VapiTool> {
    return this.sdk.tools.get({ id: toolId }) as any;
  }

  /**
   * Create a new tool
   */
  async createTool(tool: VapiTool): Promise<VapiTool> {
    return this.sdk.tools.create(tool as any) as any;
  }

  /**
   * Update existing tool
   */
  async updateTool(toolId: string, tool: Partial<VapiTool>): Promise<VapiTool> {
    // Remove fields that Vapi doesn't accept on update
    const { id, type, ...updateData } = tool;
    return this.sdk.tools.update({ id: toolId, body: updateData as any }) as any;
  }

  /**
   * Delete a tool
   */
  async deleteTool(toolId: string): Promise<void> {
    await this.sdk.tools.delete({ id: toolId });
  }

  // ==================== ASSISTANTS ====================

  /**
   * List all assistants
   */
  async listAssistants(params?: VapiQueryParams): Promise<VapiListResponse<VapiAssistant>> {
    const response = await this.sdk.assistants.list(params as any);
    return {
      results: response as any,
      count: Array.isArray(response) ? response.length : 0
    };
  }

  /**
   * Get assistant by ID
   */
  async getAssistant(assistantId: string): Promise<VapiAssistant> {
    return this.sdk.assistants.get({ id: assistantId }) as any;
  }

  /**
   * Create a new assistant
   */
  async createAssistant(assistant: VapiAssistant): Promise<VapiAssistant> {
    return this.sdk.assistants.create(assistant as any) as any;
  }

  /**
   * Update existing assistant
   */
  async updateAssistant(
    assistantId: string,
    assistant: Partial<VapiAssistant>
  ): Promise<VapiAssistant> {
    return this.sdk.assistants.update({ id: assistantId, ...assistant } as any) as any;
  }

  /**
   * Delete an assistant
   */
  async deleteAssistant(assistantId: string): Promise<void> {
    await this.sdk.assistants.delete({ id: assistantId });
  }

  // ==================== CALLS ====================

  /**
   * List all calls
   */
  async listCalls(params?: VapiQueryParams): Promise<VapiListResponse<VapiCall>> {
    const response = await this.sdk.calls.list(params as any);
    return {
      results: response as any,
      count: Array.isArray(response) ? response.length : 0
    };
  }

  /**
   * Get call by ID
   */
  async getCall(callId: string): Promise<VapiCall> {
    return this.sdk.calls.get({ id: callId }) as any;
  }

  /**
   * Get call transcript
   */
  async getCallTranscript(callId: string): Promise<string> {
    const call = await this.getCall(callId);
    return call.transcript || '';
  }

  /**
   * Get call messages
   */
  async getCallMessages(callId: string): Promise<VapiCall['messages']> {
    const call = await this.getCall(callId);
    return call.messages || [];
  }

  // ==================== PHONE NUMBERS ====================

  /**
   * List all phone numbers
   */
  async listPhoneNumbers(params?: VapiQueryParams): Promise<VapiListResponse<VapiPhoneNumber>> {
    const response = await this.sdk.phoneNumbers.list(params as any);
    return {
      results: response as any,
      count: Array.isArray(response) ? response.length : 0
    };
  }

  /**
   * Get phone number by ID
   */
  async getPhoneNumber(phoneNumberId: string): Promise<VapiPhoneNumber> {
    return this.sdk.phoneNumbers.get({ id: phoneNumberId }) as any;
  }

  /**
   * Update phone number configuration
   */
  async updatePhoneNumber(
    phoneNumberId: string,
    config: Partial<VapiPhoneNumber>
  ): Promise<VapiPhoneNumber> {
    return this.sdk.phoneNumbers.update({ id: phoneNumberId, body: config as any }) as any;
  }

  // ==================== STRUCTURED OUTPUTS ====================

  /**
   * List all structured outputs
   */
  async listStructuredOutputs(params?: VapiQueryParams): Promise<VapiListResponse<any>> {
    const response = await this.sdk.structuredOutputs.structuredOutputControllerFindAll(params as any);
    return {
      results: (response as any).results || [],
      count: (response as any).results?.length || 0
    };
  }

  /**
   * Get structured output by ID
   */
  async getStructuredOutput(structuredOutputId: string): Promise<any> {
    return this.sdk.structuredOutputs.structuredOutputControllerFindOne({ id: structuredOutputId }) as any;
  }

  /**
   * Create a new structured output
   */
  async createStructuredOutput(structuredOutput: any): Promise<any> {
    return this.sdk.structuredOutputs.structuredOutputControllerCreate(structuredOutput as any) as any;
  }

  /**
   * Update existing structured output
   */
  async updateStructuredOutput(structuredOutputId: string, structuredOutput: any): Promise<any> {
    return this.sdk.structuredOutputs.structuredOutputControllerUpdate({
      id: structuredOutputId,
      ...structuredOutput
    } as any) as any;
  }

  /**
   * Delete a structured output
   */
  async deleteStructuredOutput(structuredOutputId: string): Promise<void> {
    await this.sdk.structuredOutputs.structuredOutputControllerRemove({ id: structuredOutputId });
  }

  // ==================== ANALYTICS ====================

  /**
   * Get usage/billing data
   * Uses our enhanced analytics instead of a separate endpoint
   */
  async getUsage(startDate?: string, endDate?: string): Promise<VapiUsage> {
    const analytics = await this.getAnalytics({ startDate, endDate });
    return {
      totalCalls: analytics.totalCalls,
      totalCost: analytics.totalCost,
      totalMinutes: analytics.totalDuration / 60,
      costBreakdown: analytics.costBreakdown,
      breakdown: analytics.costBreakdown
    } as any;
  }

  /**
   * Get billing summary for calls
   */
  async getCallCosts(params?: VapiQueryParams): Promise<{ totalCost: number; calls: VapiCall[] }> {
    const response = await this.listCalls(params);
    const totalCost = response.results.reduce((sum, call) => sum + (call.cost || 0), 0);

    return {
      totalCost,
      calls: response.results
    };
  }

  /**
   * Get detailed analytics for calls
   * Returns comprehensive metrics and cost breakdowns for frontend dashboards
   */
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    assistantId?: string;
    phoneNumberId?: string;
  }): Promise<{
    totalCalls: number;
    totalCost: number;
    totalDuration: number;
    averageDuration: number;
    averageCost: number;
    costBreakdown: {
      llm: number;
      tts: number;
      stt: number;
      transport: number;
      vapi: number;
    };
    calls: VapiCall[];
  }> {
    // Build query params
    const queryParams: any = {};
    if (params?.assistantId) queryParams.assistantId = params.assistantId;
    if (params?.phoneNumberId) queryParams.phoneNumberId = params.phoneNumberId;
    if (params?.startDate) queryParams.createdAtGt = params.startDate;
    if (params?.endDate) queryParams.createdAtLt = params.endDate;

    const calls = await this.listCalls(queryParams);

    const totalCost = calls.results.reduce((sum, call) => sum + (call.cost || 0), 0);
    const totalDuration = calls.results.reduce((sum, call) => {
      if (call.endedAt && call.startedAt) {
        return sum + (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
      }
      return sum;
    }, 0);

    // Aggregate cost breakdowns
    const costBreakdown = calls.results.reduce((acc, call) => {
      if (call.costBreakdown) {
        acc.llm += call.costBreakdown.llm || 0;
        acc.tts += call.costBreakdown.tts || 0;
        acc.stt += call.costBreakdown.stt || 0;
        acc.transport += call.costBreakdown.transport || 0;
        acc.vapi += call.costBreakdown.vapi || 0;
      }
      return acc;
    }, { llm: 0, tts: 0, stt: 0, transport: 0, vapi: 0 });

    return {
      totalCalls: calls.results.length,
      totalCost,
      totalDuration,
      averageDuration: calls.results.length > 0 ? totalDuration / calls.results.length : 0,
      averageCost: calls.results.length > 0 ? totalCost / calls.results.length : 0,
      costBreakdown,
      calls: calls.results
    };
  }

  /**
   * Get cost breakdown by date range
   * Groups calls by day with costs - perfect for charts/dashboards
   */
  async getCostBreakdown(startDate: string, endDate: string): Promise<{
    daily: Array<{ date: string; cost: number; calls: number; duration: number }>;
    total: number;
    totalCalls: number;
    totalDuration: number;
  }> {
    const calls = await this.listCalls({
      createdAtGt: startDate,
      createdAtLt: endDate
    });

    // Group by day
    const dailyMap = new Map<string, { cost: number; calls: number; duration: number }>();

    calls.results.forEach(call => {
      const timestamp = call.createdAt || call.startedAt;
      if (!timestamp) return;

      const date = new Date(timestamp).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { cost: 0, calls: 0, duration: 0 };

      let duration = 0;
      if (call.endedAt && call.startedAt) {
        duration = (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
      }

      dailyMap.set(date, {
        cost: existing.cost + (call.cost || 0),
        calls: existing.calls + 1,
        duration: existing.duration + duration
      });
    });

    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      daily,
      total: daily.reduce((sum, day) => sum + day.cost, 0),
      totalCalls: daily.reduce((sum, day) => sum + day.calls, 0),
      totalDuration: daily.reduce((sum, day) => sum + day.duration, 0)
    };
  }

  /**
   * Get cost breakdown by category (LLM, TTS, STT, etc.)
   * Useful for pie charts showing where money is spent
   */
  async getCostByCategory(startDate?: string, endDate?: string): Promise<{
    llm: { cost: number; percentage: number };
    tts: { cost: number; percentage: number };
    stt: { cost: number; percentage: number };
    transport: { cost: number; percentage: number };
    vapi: { cost: number; percentage: number };
    total: number;
  }> {
    const analytics = await this.getAnalytics({ startDate, endDate });

    const breakdown = analytics.costBreakdown;
    const total = analytics.totalCost;

    return {
      llm: {
        cost: breakdown.llm,
        percentage: total > 0 ? (breakdown.llm / total) * 100 : 0
      },
      tts: {
        cost: breakdown.tts,
        percentage: total > 0 ? (breakdown.tts / total) * 100 : 0
      },
      stt: {
        cost: breakdown.stt,
        percentage: total > 0 ? (breakdown.stt / total) * 100 : 0
      },
      transport: {
        cost: breakdown.transport,
        percentage: total > 0 ? (breakdown.transport / total) * 100 : 0
      },
      vapi: {
        cost: breakdown.vapi,
        percentage: total > 0 ? (breakdown.vapi / total) * 100 : 0
      },
      total
    };
  }
}

// Export singleton instance
export const vapiClient = new VapiClient();
