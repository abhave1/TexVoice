// src/types/vapi.types.ts
// Minimal types - @vapi-ai/server-sdk handles the rest

/**
 * Our wrapper for list responses
 */
export interface VapiListResponse<T> {
  results: T[];
  count: number;
}

/**
 * Query parameters for filtering API calls
 */
export interface VapiQueryParams {
  limit?: number;
  createdAtGt?: string;
  createdAtLt?: string;
  createdAtGe?: string;
  createdAtLe?: string;
  assistantId?: string;
  phoneNumberId?: string;
}

/**
 * Usage/analytics response (our custom aggregation)
 */
export interface VapiUsage {
  totalCost: number;
  totalCalls: number;
  totalMinutes: number;
  costBreakdown: any;
  breakdown: any;
}

/**
 * SDK types (re-exported for convenience)
 * We use `any` since we cast everything in the service layer
 */
export type VapiTool = any;
export type VapiAssistant = any;
export type VapiCall = any;
export type VapiPhoneNumber = any;
