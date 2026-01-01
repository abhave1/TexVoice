// src/controllers/tools.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { VapiPayload, ToolResponse } from '../types';
import { inventoryService } from '../services/inventory.service';
import { databaseService } from '../services/database.service';
import axios from 'axios';

// ==================== TOOL REGISTRY ====================

/**
 * Tool handler configuration
 */
interface ToolHandler {
  async: boolean;
  handler: (payload: any, args: any) => string | Promise<string> | Promise<void>;
}

/**
 * Tool registry - maps VAPI function names to handlers
 * To add a new tool:
 * 1. Create tool in VAPI with function name
 * 2. Run `npm run vapi:sync` to get tool ID
 * 3. Add handler here matching the function name
 */
const toolHandlers: Record<string, ToolHandler> = {
  check_inventory: {
    async: false,
    handler: (_payload: any, args: any) => handleCheckInventory(args)
  },
  transfer_call: {
    async: true,
    handler: async (payload: any, args: any) => {
      await handleTransferCall(payload, args);
    }
  },
  schedule_callback: {
    async: false,
    handler: async (payload: any, args: any) => handleScheduleCallback(payload, args)
  }
};

/**
 * Handle tool execution requests from Vapi
 * Routes to appropriate handler based on function name
 */
export async function handleToolExecution(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = request.body as VapiPayload;
    const message = payload.message as any;

    // Safety check for tool calls
    if (!message.toolCalls || message.toolCalls.length === 0) {
      console.warn('[ToolExecution] No tool calls found in payload');
      return reply.send({ error: "No tool calls found" });
    }

    const toolCall = message.toolCalls[0];
    const functionName = toolCall.function.name;
    let args = toolCall.function.arguments;

    // Parse arguments if string (Vapi sends JSON string)
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch (e) {
        console.error('[ToolExecution] Failed to parse tool arguments:', e);
        args = {};
      }
    }

    console.log(`\n[Tool] ${functionName}(${JSON.stringify(args)})`);

    // Look up tool handler in registry
    const toolConfig = toolHandlers[functionName];

    if (!toolConfig) {
      console.warn(`[Tool] Unknown tool: ${functionName}`);
      return reply.send({
        results: [{
          toolCallId: toolCall.id,
          result: `Error: Tool '${functionName}' not found.`
        }]
      });
    }

    // Execute handler
    const result = await toolConfig.handler(payload, args);

    // Send appropriate response based on tool type
    if (toolConfig.async) {
      // Async tools (like transfer_call) don't return results
      return reply.send({ status: 'ok' });
    } else {
      // Sync tools return results to VAPI
      console.log(`[Tool Result] ${result}\n`);
      return reply.send({
        results: [{
          toolCallId: toolCall.id,
          result: result as string
        }]
      });
    }
  } catch (error: any) {
    console.error('[ToolExecution] Error:', error.message);
    console.error(error.stack);
    return reply.status(500).send({ error: 'Tool execution failed', details: error.message });
  }
}

// ==================== TOOL HANDLERS ====================

/**
 * Handle check_inventory tool
 * Client-specific inventory lookup (currently uses global inventory table)
 * TODO: Add client_id to inventory table for true multi-client support
 */
async function handleCheckInventory(args: any): Promise<string> {
  const query = args.query || "";

  // In the future, we can look up client from payload and filter inventory by client_id:
  // const phoneNumberId = payload.message?.call?.phoneNumberId;
  // const client = await databaseService.getClientByPhoneNumberId(phoneNumberId);
  // return await inventoryService.searchAndFormat(query, client.id);

  return await inventoryService.searchAndFormat(query);
}

/**
 * Handle transfer_call tool
 * Uses VAPI's live call control to dynamically route calls with warm handoff
 */
async function handleTransferCall(payload: any, args: any): Promise<void> {
  const { department, reason, urgency = 'medium' } = args;

  // Extract control URL from call monitor
  const controlUrl = payload.message?.call?.monitor?.controlUrl;
  if (!controlUrl) {
    throw new Error('Control URL not available for transfer');
  }

  // Extract caller information for handoff brief
  const callerNumber = payload.message?.call?.customer?.number || 'Unknown';
  let callerName = 'Unknown caller';

  // Try to identify caller from database
  try {
    const customer = await databaseService.getContact(callerNumber);
    if (customer) {
      callerName = `${customer.name} from ${customer.company}`;
    }
  } catch (error) {
    // If database lookup fails, continue with unknown caller
  }

  // Identify which client this call belongs to
  const phoneNumberId = payload.message?.call?.phoneNumberId;
  const client = await databaseService.getClientByPhoneNumberId(phoneNumberId);

  if (!client) {
    console.error(`[Transfer] No client found for phone number ID: ${phoneNumberId}`);
    throw new Error('Client not found for this phone number');
  }

  // Map department to database column
  const departmentPhoneMap: Record<string, string> = {
    'sales': client.sales_phone,
    'rentals': client.rentals_phone,
    'service': client.service_phone,
    'parts': client.parts_phone,
    'billing': client.billing_phone
  };

  // Get the transfer destination for this department
  const destinationNumber = departmentPhoneMap[department as 'sales' | 'rentals' | 'service' | 'parts' | 'billing'];

  if (!destinationNumber) {
    console.error(`[Transfer] No ${department} number configured for client ${client.name}`);
    throw new Error(`Transfer destination not configured for ${department}`);
  }

  // Create handoff brief for the receiving person
  const handoffBrief = `Transfer from ${client.name} receptionist. ${callerName}. ${reason}. Urgency: ${urgency}.`;

  // Create caller message
  const callerMessage = urgency === 'critical'
    ? `Connecting you to ${department} immediately.`
    : `Perfect, connecting you to ${department} now. They'll be right with you.`;

  // Execute the transfer via Live Call Control
  try {
    await axios.post(`${controlUrl}/control`, {
      type: 'transfer',
      destination: {
        type: 'number',
        number: destinationNumber,
        message: handoffBrief  // Recipient hears this BEFORE call connects
      },
      content: callerMessage  // Caller hears this during transfer
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Transfer] Failed to execute transfer:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Handle schedule_callback tool
 * Saves callback request to database for follow-up
 */
async function handleScheduleCallback(payload: any, args: any): Promise<string> {
  const { customer_name, customer_phone, preferred_time, reason, department } = args;

  // Get client info
  const phoneNumberId = payload.message?.call?.phoneNumberId;
  const client = await databaseService.getClientByPhoneNumberId(phoneNumberId);

  if (!client) {
    console.error(`[Callback] No client found for phone number ID: ${phoneNumberId}`);
    return "I've noted your callback request, but there was an issue on our end. Please try calling back during business hours.";
  }

  // Save callback request to database
  try {
    await databaseService.saveCallbackRequest({
      clientId: client.id,
      customerName: customer_name,
      customerPhone: customer_phone,
      preferredTime: preferred_time,
      reason: reason,
      department: department
    });

    console.log(`[Callback] Scheduled callback for ${customer_name} at ${preferred_time} (${department})`);

    // Return confirmation message to assistant - conversational, not robotic
    return `Got it! I've got you down for a callback ${preferred_time}. Someone from ${department} will give you a call then. Anything else you want me to pass along to them?`;
  } catch (error: any) {
    console.error('[Callback] Failed to save callback request:', error.message);
    return "Got it, I've made a note of that. Someone will give you a call back during business hours.";
  }
}
