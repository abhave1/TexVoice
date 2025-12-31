// src/config/vapi-config.ts
// Configuration-as-code for Vapi tools and assistants

import { VapiTool, VapiAssistant } from '../types/vapi.types';

/**
 * Get the server URL from environment or use default
 * Ensures no trailing slash to prevent //tools issue
 */
const getServerUrl = (): string => {
  const url = process.env.SERVER_URL || 'https://texintel.com';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

/**
 * Tool Definitions
 *
 * IMPORTANT: These tools MUST be synced to Vapi for them to work.
 * Run: npm run vapi:sync
 *
 * Tools are registered in Vapi and can be called by the AI assistant.
 * Define all your function tools here.
 */
export const VAPI_TOOLS: VapiTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_inventory',
      description: 'Check heavy equipment inventory and get comprehensive details. Returns availability, pricing, condition, year, and specs in ONE response. Use this for ANY question about equipment - availability, price, condition, specs, or comparisons. Examples: "Do you have dozers?", "How much is the excavator?", "Any cheap skid steers?", "What condition is it in?"',
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
  }

  // NOTE: Transfer tools are commented out because Vapi's transferCall type
  // is not yet supported via API. You MUST create these in the Vapi Dashboard UI.
  // Uncomment when Vapi API supports transfer tools.
  //
  // {
  //   type: 'transferCall',
  //   function: {
  //     name: 'transfer_to_sales',
  //     description: 'Transfer the call to Sales Manager when customer wants to buy, rent, get a quote, or needs pricing negotiation.',
  //   },
  //   destinations: [
  //     {
  //       type: 'number',
  //       number: process.env.SALES_PHONE_NUMBER || '+1234567890',
  //       message: 'Transferring you to our Sales Manager now...'
  //     }
  //   ]
  // },
  // {
  //   type: 'transferCall',
  //   function: {
  //     name: 'transfer_to_service',
  //     description: 'Transfer the call to Service Department when customer needs repairs, maintenance, or has a broken machine.',
  //   },
  //   destinations: [
  //     {
  //       type: 'number',
  //       number: process.env.SERVICE_PHONE_NUMBER || '+1234567890',
  //       message: 'Connecting you to our Service Desk right now...'
  //     }
  //   ]
  // }
];

/**
 * Assistant Configurations
 *
 * NOTE: These are currently NOT being used in production!
 *
 * We use DYNAMIC prompts via the /inbound endpoint (see customer.service.ts)
 * which allows personalized greetings based on caller recognition.
 *
 * These static configs are kept as:
 * 1. Reference examples for Vapi assistant structure
 * 2. Future use if we want to create static assistants
 * 3. Templates for different use cases (default, VIP, etc.)
 *
 * To use these, you would create them in Vapi and assign to phone numbers,
 * but dynamic prompts via /inbound is more powerful for our use case.
 */
export const VAPI_ASSISTANTS: Record<string, Partial<VapiAssistant>> = {
  // Default assistant for all calls
  default: {
    name: 'Tex - Default Receptionist',
    model: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are 'Tex', the AI receptionist for Tex Intel, a heavy equipment dealer.
Your goal is to route calls to Sales or Service.
- Be concise. Do not ramble.
- If inventory is requested, use the 'check_inventory' tool.
- If the user wants to buy/rent, ask for details then transfer.
- Be friendly and professional.
- Do not add or say anything more than you have. If you do not have info, say that "i am sorry i do not have that information". and say that I can help route you to the correct personal or department for further information.`
        }
      ]
    },
    firstMessage: 'Thanks for calling Tex Intel. How can I help you?',
    firstMessageMode: 'assistant-speaks-first',
    serverUrl: `${getServerUrl()}/inbound`,
    endCallMessage: 'Thanks for calling Tex Intel. Have a great day!',
    maxDurationSeconds: 600, // 10 minutes max
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.4,
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true
  },

  // VIP assistant for high-value customers
  vip: {
    name: 'Tex - VIP Receptionist',
    model: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are 'Tex', the AI receptionist for Tex Intel, speaking to a VIP customer.
- Be extra attentive and personalized
- Priority response - transfer to sales immediately if requested
- Offer premium equipment options
- Use the 'check_inventory' tool when needed`
        }
      ]
    },
    firstMessage: 'Welcome back to Tex Intel! How may I assist you today?',
    maxDurationSeconds: 900 // 15 minutes for VIP
  }
};

/**
 * Tool name lookup
 */
export const getToolByName = (name: string): VapiTool | undefined => {
  return VAPI_TOOLS.find(tool => tool.function.name === name);
};

/**
 * Get all tool names
 */
export const getToolNames = (): string[] => {
  return VAPI_TOOLS.map(tool => tool.function.name);
};

/**
 * Phone Number Configuration
 *
 * This defines the desired configuration for your Vapi phone numbers.
 * The sync script will update your phone numbers to match this config.
 *
 * NOTE: You need to buy phone numbers in Vapi dashboard first.
 * This config just updates their settings.
 */
export const PHONE_NUMBER_CONFIG = {
  // Default config applied to ALL phone numbers
  default: {
    serverUrl: `${getServerUrl()}/inbound`,
    serverUrlSecret: process.env.VAPI_SERVER_SECRET || undefined,
    // CRITICAL: assistantId MUST be null to use dynamic prompts from /inbound
    // If assistantId is set, Vapi ignores /inbound and uses the static assistant
    assistantId: null
  }

  // Optional: Override config for specific phone numbers
  // '+1234567890': {
  //   serverUrl: `${getServerUrl()}/inbound`,
  //   assistantId: 'specific-assistant-id'
  // }
};
