// src/types.ts

/**
 * Base VAPI webhook payload
 * VAPI sends different message types throughout call lifecycle
 */
export interface VapiPayload {
  message: VapiMessage;
}

/**
 * Union type for all possible VAPI message types
 */
export type VapiMessage =
  | AssistantRequestMessage
  | StatusUpdateMessage
  | ConversationUpdateMessage
  | EndOfCallReportMessage
  | ToolCallsMessage;

/**
 * Initial call - VAPI asking for assistant configuration
 */
export interface AssistantRequestMessage {
  type: 'assistant-request';
  call: {
    id: string;
    type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
    status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
    phoneNumberId?: string;
    customer?: {
      number: string;
    };
  };
}

/**
 * Call status changes
 */
export interface StatusUpdateMessage {
  type: 'status-update';
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  call?: {
    id: string;
  };
  inboundPhoneCallDebuggingArtifacts?: {
    error?: string;
    assistantRequestError?: string;
    assistantRequestResponse?: any;
  };
}

/**
 * Real-time conversation updates
 */
export interface ConversationUpdateMessage {
  type: 'conversation-update';
  conversation: Array<{
    role: 'assistant' | 'user' | 'system' | 'tool';
    message?: string;
    name?: string;
    time: number;
  }>;
  call?: {
    id: string;
  };
}

/**
 * Final call report with analysis and artifacts
 */
export interface EndOfCallReportMessage {
  type: 'end-of-call-report';
  call: {
    id: string;
    status: 'ended';
    endedReason?: string;
    startedAt?: string;
    endedAt?: string;
  };
  transcript?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  summary?: string;
  analysis?: {
    successEvaluation?: string;
    structuredData?: Record<string, any>;
  };
  messages?: Array<{
    role: 'assistant' | 'user' | 'system' | 'tool' | 'function';
    message?: string;
    name?: string;
    args?: string;
    result?: string;
    time?: number;
  }>;
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
}

/**
 * Tool calls - handled by /tools endpoint
 */
export interface ToolCallsMessage {
  type: 'tool-calls';
  toolCalls: VapiToolCall[];
  call?: {
    id: string;
  };
}

export interface VapiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface ToolResponse {
  results: {
    toolCallId: string;
    result: string;
  }[];
}

export interface Customer {
  name: string;
  company: string;
  last_machine: string;
  status: 'VIP' | 'New' | 'Bad Standing';
}

export interface InventoryItem {
  model: string;
  category: string;
  available: number;
  price_per_day: number;
  condition?: string;
  year?: number;
  specs?: string;
}
