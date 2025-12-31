// src/services/vapi-client.service.ts
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
 * Vapi API Client
 * Handles all interactions with the Vapi API
 */
export class VapiClient {
  private apiKey: string;
  private baseUrl = 'https://api.vapi.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VAPI_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[VapiClient] WARNING: No API key provided. Set VAPI_API_KEY environment variable.');
    }
  }

  /**
   * Make authenticated request to Vapi API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[VapiClient] ${method} ${endpoint} - ${response.status}:`, error.substring(0, 200));
        throw new Error(`Vapi API Error (${response.status}): ${error}`);
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      console.error(`[VapiClient] ${method} ${endpoint} - ERROR:`, error.message);
      throw error;
    }
  }

  // ==================== TOOLS ====================

  /**
   * List all tools
   */
  async listTools(params?: VapiQueryParams): Promise<VapiListResponse<VapiTool>> {
    const query = new URLSearchParams(params as any).toString();
    const response = await this.request<VapiTool[] | VapiListResponse<VapiTool>>(
      `/tool${query ? `?${query}` : ''}`
    );

    // Vapi returns a direct array, so wrap it in our standard response format
    if (Array.isArray(response)) {
      return {
        results: response,
        count: response.length
      };
    }

    return response;
  }

  /**
   * Get tool by ID
   */
  async getTool(toolId: string): Promise<VapiTool> {
    return this.request<VapiTool>(`/tool/${toolId}`);
  }

  /**
   * Create a new tool
   */
  async createTool(tool: VapiTool): Promise<VapiTool> {
    return this.request<VapiTool>('/tool', {
      method: 'POST',
      body: JSON.stringify(tool)
    });
  }

  /**
   * Update existing tool
   */
  async updateTool(toolId: string, tool: Partial<VapiTool>): Promise<VapiTool> {
    // Remove fields that Vapi doesn't accept on update
    const { id, type, ...updateData } = tool;

    return this.request<VapiTool>(`/tool/${toolId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete a tool
   */
  async deleteTool(toolId: string): Promise<void> {
    await this.request<void>(`/tool/${toolId}`, {
      method: 'DELETE'
    });
  }

  // ==================== ASSISTANTS ====================

  /**
   * List all assistants
   */
  async listAssistants(params?: VapiQueryParams): Promise<VapiListResponse<VapiAssistant>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<VapiListResponse<VapiAssistant>>(
      `/assistant${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get assistant by ID
   */
  async getAssistant(assistantId: string): Promise<VapiAssistant> {
    return this.request<VapiAssistant>(`/assistant/${assistantId}`);
  }

  /**
   * Create a new assistant
   */
  async createAssistant(assistant: VapiAssistant): Promise<VapiAssistant> {
    return this.request<VapiAssistant>('/assistant', {
      method: 'POST',
      body: JSON.stringify(assistant)
    });
  }

  /**
   * Update existing assistant
   */
  async updateAssistant(
    assistantId: string,
    assistant: Partial<VapiAssistant>
  ): Promise<VapiAssistant> {
    return this.request<VapiAssistant>(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(assistant)
    });
  }

  /**
   * Delete an assistant
   */
  async deleteAssistant(assistantId: string): Promise<void> {
    await this.request<void>(`/assistant/${assistantId}`, {
      method: 'DELETE'
    });
  }

  // ==================== CALLS ====================

  /**
   * List all calls
   */
  async listCalls(params?: VapiQueryParams): Promise<VapiListResponse<VapiCall>> {
    const query = new URLSearchParams(params as any).toString();
    const response = await this.request<VapiCall[] | VapiListResponse<VapiCall>>(
      `/call${query ? `?${query}` : ''}`
    );

    // Vapi returns a direct array, so wrap it in our standard response format
    if (Array.isArray(response)) {
      return {
        results: response,
        count: response.length
      };
    }

    return response;
  }

  /**
   * Get call by ID
   */
  async getCall(callId: string): Promise<VapiCall> {
    return this.request<VapiCall>(`/call/${callId}`);
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
    const query = new URLSearchParams(params as any).toString();
    return this.request<VapiListResponse<VapiPhoneNumber>>(
      `/phone-number${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get phone number by ID
   */
  async getPhoneNumber(phoneNumberId: string): Promise<VapiPhoneNumber> {
    return this.request<VapiPhoneNumber>(`/phone-number/${phoneNumberId}`);
  }

  /**
   * Update phone number configuration
   */
  async updatePhoneNumber(
    phoneNumberId: string,
    config: Partial<VapiPhoneNumber>
  ): Promise<VapiPhoneNumber> {
    return this.request<VapiPhoneNumber>(`/phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      body: JSON.stringify(config)
    });
  }

  // ==================== ANALYTICS ====================

  /**
   * Get usage/billing data
   * Note: This is a simplified version - adjust based on actual Vapi API
   */
  async getUsage(startDate?: string, endDate?: string): Promise<VapiUsage> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    // This endpoint may vary based on Vapi's actual API
    return this.request<VapiUsage>(
      `/analytics/usage${params.toString() ? `?${params.toString()}` : ''}`
    );
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
}

// Export singleton instance
export const vapiClient = new VapiClient();
