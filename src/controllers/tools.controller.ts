// src/controllers/tools.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { VapiPayload, ToolResponse } from '../types';
import { inventoryService } from '../services/inventory.service';

/**
 * Handle tool execution requests from Vapi
 * Currently supports: check_inventory
 */
export async function handleToolExecution(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.body as VapiPayload;

  // Safety check for tool calls
  if (!payload.message.toolCalls) {
    console.warn('[ToolExecution] No tool calls found in payload');
    return reply.send({ error: "No tool calls found" });
  }

  const toolCall = payload.message.toolCalls[0];
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

  console.log(`[ToolExecution] Executing tool: ${functionName}`, { args });

  let result = "Tool not found.";

  // Route to appropriate tool handler
  if (functionName === 'check_inventory') {
    result = handleCheckInventory(args);

    // Log result type
    let resultType = 'no matches';
    if (result.includes('I found')) {
      resultType = 'summary mode (6+ items)';
    } else if (result.includes('We have')) {
      resultType = 'full details (2-5 items)';
    } else if (result.includes('Yes, we have')) {
      resultType = 'single item';
    }

    console.log(`[ToolExecution] ${functionName} completed - Query: "${args.query}" -> ${resultType}`);
    console.log(`[ToolExecution] Response preview: ${result.substring(0, 120)}...`);
  } else {
    console.warn(`[ToolExecution] Unknown tool requested: ${functionName}`);
  }

  // Return format required by Vapi
  const response: ToolResponse = {
    results: [
      {
        toolCallId: toolCall.id,
        result: result
      }
    ]
  };

  return reply.send(response);
}

/**
 * Handle check_inventory tool
 */
function handleCheckInventory(args: any): string {
  const query = args.query || "";
  return inventoryService.searchAndFormat(query);
}
