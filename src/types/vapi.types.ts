// src/types/vapi.types.ts
// TypeScript types for Vapi API

/**
 * Vapi Tool Definition (Function or TransferCall)
 */
export type VapiTool = VapiFunctionTool | VapiTransferCallTool;

/**
 * Function Tool (custom server-side logic)
 */
export interface VapiFunctionTool {
  id?: string;
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
  async?: boolean;
  messages?: Array<{ role: string; content: string }>;
  server?: {
    url: string;
    secret?: string;
  };
}

/**
 * TransferCall Tool (VAPI-handled call transfers)
 */
export interface VapiTransferCallTool {
  id?: string;
  type: 'transferCall';
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
  destinations: Array<{
    type: 'number' | 'sip';
    number?: string;
    sipUri?: string;
    description?: string;
    transferPlan?: {
      mode: 'warm-transfer-with-summary' | 'rolling-transfer' | 'warm-transfer-experimental';
      summaryPlan?: {
        enabled: boolean;
        messages?: Array<{
          role: 'system' | 'user';
          content: string;
        }>;
      };
      timeout?: number;
    };
  }>;
  messages?: Array<{
    type: 'request-start' | 'request-complete' | 'request-failed';
    content: string;
  }>;
}

/**
 * Vapi Assistant Configuration
 */
export interface VapiAssistant {
  id?: string;
  name?: string;
  model?: {
    provider: 'openai' | 'groq' | 'anthropic' | '11labs' | 'together-ai';
    model: string;
    temperature?: number;
    maxTokens?: number;
    messages?: Array<{ role: string; content: string }>;
  };
  voice?: {
    provider: '11labs' | 'playht' | 'rime-ai' | 'deepgram' | 'openai' | 'vapi';
    voiceId: string;
  };
  firstMessage?: string;
  firstMessageMode?: 'assistant-speaks-first' | 'assistant-waits-for-user';
  transcriber?: {
    provider: 'deepgram' | 'talkscriber';
    model?: string;
    language?: string;
  };
  serverUrl?: string;
  serverUrlSecret?: string;
  endCallMessage?: string;
  endCallPhrases?: string[];
  metadata?: Record<string, any>;
  clientMessages?: string[];
  serverMessages?: string[];
  silenceTimeoutSeconds?: number;
  responseDelaySeconds?: number;
  llmRequestDelaySeconds?: number;
  numWordsToInterruptAssistant?: number;
  maxDurationSeconds?: number;
  backgroundSound?: 'off' | 'office';
  backchannelingEnabled?: boolean;
  backgroundDenoisingEnabled?: boolean;
  modelOutputInMessagesEnabled?: boolean;
  analysisPlan?: {
    summaryPlan?: {
      enabled: boolean;
      messages?: Array<{
        role: 'system' | 'user';
        content: string;
      }>;
    };
    successEvaluationPlan?: {
      enabled: boolean;
      rubric?: 'NumericScale' | 'DescriptiveScale' | 'Checklist' | 'Matrix' | 'PercentageScale' | 'LikertScale' | 'AutomaticRubric' | 'PassFail';
      messages?: Array<{
        role: 'system' | 'user';
        content: string;
      }>;
    };
    // Legacy approach for structured data extraction
    structuredDataPrompt?: string;
    structuredDataSchema?: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
  artifactPlan?: {
    structuredOutputIds?: string[];
  };
}

/**
 * Vapi Call Object
 */
export interface VapiCall {
  id: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  phoneNumberId?: string;
  customerId?: string;
  phoneNumber?: string;
  assistantId?: string;
  assistant?: VapiAssistant;
  squadId?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  costBreakdown?: {
    transport?: number;
    stt?: number;
    llm?: number;
    tts?: number;
    vapi?: number;
    total?: number;
    llmPromptTokens?: number;
    llmCompletionTokens?: number;
    ttsCharacters?: number;
  };
  messages?: Array<{
    role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
    message?: string;
    name?: string;
    args?: string;
    result?: string;
    time?: number;
    endTime?: number;
    secondsFromStart?: number;
  }>;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  analysis?: {
    successEvaluation?: string;
    structuredData?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

/**
 * Vapi Phone Number
 */
export interface VapiPhoneNumber {
  id: string;
  orgId: string;
  number: string;
  createdAt: string;
  updatedAt: string;
  stripeSubscriptionId?: string;
  name?: string;
  assistantId?: string;
  squadId?: string;
  serverUrl?: string;
  serverUrlSecret?: string;
}

/**
 * Vapi API List Response
 */
export interface VapiListResponse<T> {
  results: T[];
  count: number;
}

/**
 * Vapi API Query Parameters
 */
export interface VapiQueryParams {
  limit?: number;
  createdAtGt?: string;
  createdAtLt?: string;
  createdAtGe?: string;
  createdAtLe?: string;
  updatedAtGt?: string;
  updatedAtLt?: string;
  updatedAtGe?: string;
  updatedAtLe?: string;
  assistantId?: string;
  phoneNumberIdAny?: string;
}

/**
 * Vapi Billing/Usage Response
 */
export interface VapiUsage {
  totalCost: number;
  totalCalls: number;
  totalMinutes: number;
  breakdown: {
    date: string;
    cost: number;
    calls: number;
    minutes: number;
  }[];
}
