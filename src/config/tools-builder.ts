// src/config/tools-builder.ts
import { VapiTool } from '../types/vapi.types';

function getServerUrl(): string {
  return (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * STATIC TOOLS - Created once in Vapi, client-specific data loaded from DB at runtime
 *
 * When these tools are called:
 * 1. Vapi sends tool request to our /tools endpoint
 * 2. We extract assistantId or phoneNumberId from the request
 * 3. We look up which client owns that assistant/phone
 * 4. We fetch that client's specific data from database
 * 5. We execute the tool using their data
 */

/**
 * Build check_inventory tool (static - client data from DB at runtime)
 */
export function buildCheckInventoryTool(): VapiTool {
  return {
    type: 'function',
    function: {
      name: 'check_inventory',
      description: 'Check equipment inventory and get comprehensive details. Returns availability, pricing, condition, year, and specs in ONE response. Use this for ANY question about equipment - availability, price, condition, specs, or comparisons. Examples: "Do you have dozers?", "How much is the excavator?", "Any cheap skid steers?", "What condition is it in?"',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Type of equipment to search for (e.g., excavator, bulldozer, dozer, loader, skid steer, dump truck, crane, backhoe) or specific model (e.g., Cat D6, Bobcat T76)'
          }
        },
        required: ['query']
      }
    },
    async: false,
    server: {
      url: `${getServerUrl()}/tools`
    }
  };
}

/**
 * Build transfer_call tool (static - department phones from DB at runtime)
 *
 * This is a FUNCTION tool, not transferCall type.
 * When called:
 * 1. Our /tools endpoint receives the department parameter
 * 2. We look up which client is calling (from assistantId/phoneNumberId)
 * 3. We fetch their department phone from the database
 * 4. We return the phone number and transfer instructions
 * 5. The response triggers a programmatic transfer via Vapi API
 */
export function buildTransferCallTool(): VapiTool {
  return {
    type: 'function',
    function: {
      name: 'transfer_call',
      description: 'Transfer the call to the appropriate department. Use this when the customer wants to: (1) SALES: purchase equipment, get a quote, or general sales inquiry; (2) RENTALS: rent equipment, ask about rental availability or pricing; (3) SERVICE: report breakdown, request repairs, or maintenance issues; (4) PARTS: order replacement parts or ask about parts availability; (5) BILLING: invoice questions, payment issues, or account inquiries',
      parameters: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            enum: ['sales', 'rentals', 'service', 'parts', 'billing'],
            description: 'Which department to transfer to'
          },
          reason: {
            type: 'string',
            description: 'Brief reason for transfer (e.g., "wants to rent Cat D8", "excavator breakdown", "needs undercarriage parts")'
          }
        },
        required: ['department', 'reason']
      }
    },
    async: false,
    server: {
      url: `${getServerUrl()}/tools`
    }
  };
}

/**
 * Build schedule_callback tool
 * Used when office is closed or customer wants callback at specific time
 */
export function buildScheduleCallbackTool(): VapiTool {
  return {
    type: 'function',
    function: {
      name: 'schedule_callback',
      description: 'Schedule a callback for the customer. Use this when: (1) Office is CLOSED and customer needs help, (2) Customer explicitly requests a callback, (3) Customer wants to be contacted at a specific time. Ask for their preferred callback time (e.g., "tomorrow morning", "this afternoon at 2pm", "Monday").',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Customer\'s name'
          },
          customer_phone: {
            type: 'string',
            description: 'Customer\'s phone number for callback'
          },
          preferred_time: {
            type: 'string',
            description: 'When they want to be called back (e.g., "tomorrow morning", "Monday at 9am", "this afternoon")'
          },
          reason: {
            type: 'string',
            description: 'Brief reason for callback (e.g., "interested in Cat D8 rental", "service question", "general inquiry")'
          },
          department: {
            type: 'string',
            enum: ['sales', 'rentals', 'service', 'parts', 'billing', 'general'],
            description: 'Which department should handle the callback'
          }
        },
        required: ['customer_name', 'customer_phone', 'preferred_time', 'reason', 'department']
      }
    },
    async: false,
    server: {
      url: `${getServerUrl()}/tools`
    }
  };
}

/**
 * Get ALL static tools (not client-specific)
 * These tools are created ONCE in Vapi and shared across all clients
 * Client-specific data is loaded from database when tools are called
 */
export function getAllStaticTools(): VapiTool[] {
  return [
    buildCheckInventoryTool(),
    buildTransferCallTool(),
    buildScheduleCallbackTool()
  ];
}

/**
 * Get enabled tool IDs for a specific client
 * Returns which tools this client should have access to
 */
export function getEnabledToolsForClient(client: {
  enable_inventory?: boolean | number;
  enable_transfers?: boolean | number;
}): string[] {
  const enabledTools: string[] = [];

  if (client.enable_inventory) {
    enabledTools.push('check_inventory');
  }

  if (client.enable_transfers) {
    enabledTools.push('transfer_call');
  }

  return enabledTools;
}

/**
 * Structured output schema for call analysis
 */
export const STRUCTURED_OUTPUT_SCHEMA = {
  name: "Call Analysis - Tex Intel",
  type: "ai" as const,
  description: "Extract caller information, intent, machine details, and outcome from heavy equipment calls",
  schema: {
    type: "object" as const,
    properties: {
      caller: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const, description: "Caller's full name if mentioned" },
          company: { type: "string" as const, description: "Company name if mentioned" },
          phone: { type: "string" as const, description: "Phone number (from call metadata or if mentioned)" },
          email: { type: "string" as const, description: "Email address if provided" }
        }
      },
      intent: {
        type: "object" as const,
        properties: {
          category: {
            type: "string" as const,
            enum: ["sales", "rental", "parts", "service", "billing", "general", "other"],
            description: "Primary intent category"
          },
          subcategory: {
            type: "string" as const,
            description: "Specific subcategory (e.g., 'dozer rental inquiry', 'breakdown repair', 'parts availability')"
          }
        },
        required: ["category"]
      },
      machine: {
        type: "object" as const,
        properties: {
          make: { type: "string" as const, description: "Manufacturer (e.g., Caterpillar, Komatsu, John Deere)" },
          model: { type: "string" as const, description: "Model number/name (e.g., D8, 336, PC390)" },
          year: { type: "number" as const, description: "Year of manufacture if mentioned" },
          serial: { type: "string" as const, description: "Serial number if provided" },
          category: { type: "string" as const, description: "Equipment type (e.g., dozer, excavator, loader, skid steer)" }
        }
      },
      details: {
        type: "object" as const,
        properties: {
          location: { type: "string" as const, description: "Jobsite location, city, or general area mentioned" },
          timing: { type: "string" as const, description: "When they need equipment (e.g., 'ASAP', 'tomorrow', 'next week', 'June 15th')" },
          urgency: {
            type: "string" as const,
            enum: ["low", "medium", "high", "critical"],
            description: "How urgent is their need"
          }
        }
      },
      outcome: {
        type: "object" as const,
        properties: {
          type: {
            type: "string" as const,
            enum: ["transferred", "callback_scheduled", "voicemail", "wrong_number", "not_interested", "information_provided", "other"],
            description: "What happened on this call"
          },
          transferred_to: {
            type: "string" as const,
            enum: ["sales", "service", "parts"],
            description: "Which department the call was transferred to (if transferred)"
          },
          next_step: {
            type: "string" as const,
            description: "What happens next (e.g., 'Sales will call back', 'Customer will email quote', 'Booking in progress')"
          },
          callback_scheduled_for: {
            type: "string" as const,
            description: "REQUIRED if outcome type is 'callback_scheduled'. Extract the exact time/day when the AI scheduled the callback (e.g., 'tomorrow at 8 AM', 'Monday at 9am', 'this afternoon at 2pm'). Look for phrases like 'I've scheduled your callback for...' or 'We'll call you back...'"
          }
        },
        required: ["type"]
      },
      notes: {
        type: "string" as const,
        description: "Any additional important details not captured in other fields"
      }
    },
    required: ["intent", "outcome"]
  }
};
