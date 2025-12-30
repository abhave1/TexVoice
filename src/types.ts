// src/types.ts

export interface VapiPayload {
  message: {
    type: string;
    call?: {
      customer?: {
        number: string;
      };
    };
    toolCalls?: VapiToolCall[];
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
