// src/types.ts
// Minimal webhook types matching what Vapi actually sends

/**
 * Base VAPI webhook payload
 */
export interface VapiPayload {
  message: VapiMessage;
}

/**
 * Union type for all possible VAPI message types
 */
export type VapiMessage =
  | AssistantRequestMessage
  | AssistantStartedMessage
  | StatusUpdateMessage
  | ConversationUpdateMessage
  | SpeechUpdateMessage
  | EndOfCallReportMessage;

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
 * Assistant started notification
 */
export interface AssistantStartedMessage {
  type: 'assistant.started';
  call?: { id: string };
}

/**
 * Call status changes
 */
export interface StatusUpdateMessage {
  type: 'status-update';
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  call?: { id: string };
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
  call?: { id: string };
}

/**
 * Real-time speech transcription updates
 */
export interface SpeechUpdateMessage {
  type: 'speech-update';
  call?: { id: string };
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
  cost?: number;
  costBreakdown?: {
    transport?: number;
    stt?: number;
    llm?: number;
    tts?: number;
    vapi?: number;
  };
}

/**
 * Tool execution types
 */
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

/**
 * Business domain types (custom to our application)
 */
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

export interface ClientConfig {
  id: string;
  name: string;
  phone_numbers: string[];  // VAPI phone numbers owned by this client
  transfer_destinations: {
    sales: string;
    service: string;
    parts: string;
  };
  greeting?: string;
}
