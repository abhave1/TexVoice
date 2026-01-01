// src/controllers/client.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { databaseService } from '../services/database.service';
import { vapiClient } from '../services/vapi-client.service';
import { buildAssistantConfig } from '../config/assistant-config';
import { getAllStaticTools, STRUCTURED_OUTPUT_SCHEMA } from '../config/tools-builder';
import fs from 'fs';
import path from 'path';

const CLIENT_ID = 'client-portal';
const HARDCODED_TOKEN = 'simple-token-123';
const HARDCODED_USERNAME = 'test';
const HARDCODED_PASSWORD = 'test';

/**
 * Handle login request
 */
export async function handleLogin(
  request: FastifyRequest<{
    Body: { username: string; password: string };
  }>,
  reply: FastifyReply
) {
  const { username, password } = request.body;

  if (username === HARDCODED_USERNAME && password === HARDCODED_PASSWORD) {
    return reply.send({
      success: true,
      token: HARDCODED_TOKEN,
      message: 'Login successful'
    });
  }

  return reply.status(401).send({
    success: false,
    message: 'Invalid credentials'
  });
}

/**
 * Verify authentication token
 */
function verifyAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ success: false, message: 'Unauthorized' });
    return false;
  }

  const token = authHeader.substring(7);
  if (token !== HARDCODED_TOKEN) {
    reply.status(401).send({ success: false, message: 'Invalid token' });
    return false;
  }

  return true;
}

/**
 * Get client configuration
 */
export async function getClientConfig(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!verifyAuth(request, reply)) return;

  try {
    const config = await databaseService.getClientConfig(CLIENT_ID);

    if (!config) {
      // Return default empty config
      return reply.send({
        success: true,
        config: {
          id: CLIENT_ID,
          name: '',
          company: '',
          sales_phone_number: '',
          service_phone_number: '',
          parts_phone_number: '',
          custom_prompt: '',
          first_message_template: '',
          enable_inventory: 1,
          enable_transfers: 1,
          vapi_assistant_id: null,
          vapi_phone_number_id: null,
          phone_number: null
        }
      });
    }

    return reply.send({
      success: true,
      config
    });
  } catch (error: any) {
    console.error('[ClientController] Error getting config:', error.message);
    return reply.status(500).send({
      success: false,
      message: 'Failed to load configuration',
      error: error.message
    });
  }
}

/**
 * Save client configuration
 */
export async function saveClientConfig(
  request: FastifyRequest<{
    Body: {
      name: string;
      company?: string;
      phoneNumber?: string;
      vapiPhoneNumberId?: string;
      enableInventory: boolean;
      enableTransfers: boolean;
      customPrompt?: string;
      firstMessage?: string;
      salesPhone?: string;
      servicePhone?: string;
      partsPhone?: string;
    };
  }>,
  reply: FastifyReply
) {
  if (!verifyAuth(request, reply)) return;

  try {
    const body = request.body;

    // Validate required fields
    if (!body.name) {
      return reply.status(400).send({
        success: false,
        message: 'Client name is required'
      });
    }

    // Upsert client
    await databaseService.upsertClient({
      id: CLIENT_ID,
      name: body.name,
      company: body.company,
      salesPhone: body.salesPhone,
      servicePhone: body.servicePhone,
      partsPhone: body.partsPhone,
      customPrompt: body.customPrompt,
      firstMessageTemplate: body.firstMessage,
      enableInventory: body.enableInventory,
      enableTransfers: body.enableTransfers
    });

    // Update phone number mapping if provided
    if (body.phoneNumber && body.vapiPhoneNumberId) {
      await databaseService.addClientPhoneNumber(
        CLIENT_ID,
        body.vapiPhoneNumberId,
        body.phoneNumber
      );
    }

    // Get updated config
    const config = await databaseService.getClientConfig(CLIENT_ID);

    return reply.send({
      success: true,
      message: 'Configuration saved successfully',
      config
    });
  } catch (error: any) {
    console.error('[ClientController] Error saving config:', error.message);
    return reply.status(500).send({
      success: false,
      message: 'Failed to save configuration',
      error: error.message
    });
  }
}

/**
 * Sync client configuration with Vapi
 */
export async function syncClientConfig(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!verifyAuth(request, reply)) return;

  const results: any = {
    success: true,
    steps: []
  };

  try {

    // Step 1: Sync tools
    console.log('[ClientController] Step 1: Syncing tools...');
    try {
      const toolResults = await syncTools();
      results.steps.push({
        name: 'tools',
        success: true,
        ...toolResults
      });
    } catch (error: any) {
      results.steps.push({
        name: 'tools',
        success: false,
        error: error.message
      });
      throw new Error(`Tool sync failed: ${error.message}`);
    }

    // Step 2: Sync structured outputs
    console.log('[ClientController] Step 2: Syncing structured outputs...');
    try {
      const structuredOutputResult = await syncStructuredOutputs();
      results.steps.push({
        name: 'structured_outputs',
        success: true,
        ...structuredOutputResult
      });
    } catch (error: any) {
      results.steps.push({
        name: 'structured_outputs',
        success: false,
        error: error.message
      });
      throw new Error(`Structured output sync failed: ${error.message}`);
    }

    // Step 3: Sync assistant
    console.log('[ClientController] Step 3: Syncing assistant...');
    try {
      const assistantResult = await syncAssistant();
      results.steps.push({
        name: 'assistant',
        success: true,
        ...assistantResult
      });
      results.assistantId = assistantResult.assistantId;
    } catch (error: any) {
      results.steps.push({
        name: 'assistant',
        success: false,
        error: error.message
      });
      throw new Error(`Assistant sync failed: ${error.message}`);
    }

    // Step 4: Sync phone number
    console.log('[ClientController] Step 4: Syncing phone number...');
    try {
      const phoneResult = await syncPhoneNumber();
      results.steps.push({
        name: 'phone_number',
        success: true,
        ...phoneResult
      });
      results.phoneNumber = phoneResult.phoneNumber;
    } catch (error: any) {
      results.steps.push({
        name: 'phone_number',
        success: false,
        error: error.message
      });
      // Phone sync failure is not fatal if no phone is configured
      if (!error.message.includes('No phone number configured')) {
        throw new Error(`Phone number sync failed: ${error.message}`);
      }
    }

    return reply.send(results);
  } catch (error: any) {
    console.error('[ClientController] Sync failed:', error.message);
    return reply.status(500).send({
      success: false,
      message: 'Sync failed',
      error: error.message,
      steps: results.steps || []
    });
  }
}

/**
 * Get available Vapi phone numbers
 */
export async function getVapiPhoneNumbers(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!verifyAuth(request, reply)) return;

  try {
    const response = await vapiClient.listPhoneNumbers();

    // Vapi returns either an array directly or {results: [...]}
    const phoneNumbers = Array.isArray(response) ? response : (response.results || []);

    return reply.send({
      success: true,
      phoneNumbers: phoneNumbers.map((pn: any) => ({
        id: pn.id,
        number: pn.number,
        name: pn.name || pn.number,
        provider: pn.provider
      }))
    });
  } catch (error: any) {
    console.error('[ClientController] Error fetching phone numbers:', error.message);
    return reply.status(500).send({
      success: false,
      message: 'Failed to fetch phone numbers',
      error: error.message
    });
  }
}

/**
 * Get calls for this client (from database and Vapi)
 */
export async function getClientCalls(request: FastifyRequest<{ Querystring: { limit?: string };}>, reply: FastifyReply) {
  if (!verifyAuth(request, reply)) return;

  try {
    const limit = parseInt(request.query.limit || '25');

    // Get client config to find their assistant and phone number
    const client = await databaseService.getClientConfig(CLIENT_ID);
    console.log('[ClientController] Retrieved client config for calls:', client);

    if (!client) {
      return reply.send({
        success: true,
        calls: []
      });
    }

    // Fetch more calls than needed to ensure we get enough after filtering
    const vapiCalls = await vapiClient.listCalls({
      assistantId: client.vapi_assistant_id || undefined,
      limit: limit
    });

    const allCalls = Array.isArray(vapiCalls) ? vapiCalls : (vapiCalls.results || []);

    // Batch fetch structured data from database (single query instead of N queries)
    const callIds = allCalls.map((call: any) => call.id);
    const dbCalls = await databaseService.getCallsByIds(callIds);

    // Create a map for O(1) lookup
    const dbCallsMap = new Map(dbCalls.map(call => [call.id, call]));

    // Attach structured data to each call
    const callsWithStructuredData = allCalls.map((call: any) => {
      const dbCall = dbCallsMap.get(call.id);

      return {
        ...call,
        structuredData: dbCall ? {
          intent_category: dbCall.intent_category,
          machine_make: dbCall.machine_make,
          machine_model: dbCall.machine_model,
          outcome_type: dbCall.outcome_type
        } : null
      };
    });

    return reply.send({
      success: true,
      calls: callsWithStructuredData
    });
  } catch (error: any) {
    console.error('[ClientController] Error fetching calls:', error.message);
    return reply.status(500).send({
      success: false,
      message: 'Failed to fetch calls',
      error: error.message
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Sync static tools to Vapi
 * Tools are shared across all clients - client-specific data loaded at runtime from DB
 */
async function syncTools() {
  const results = [];

  // Get ALL static tools (not client-specific)
  const staticTools = getAllStaticTools();

  console.log(`[ClientController] Syncing ${staticTools.length} static tools to Vapi`);

  // Fetch existing tools ONCE before the loop
  const existingTools = await vapiClient.listTools();

  for (const tool of staticTools) {
    const existing = existingTools.results.find(
      (t: any) => t.function.name === tool.function.name
    );

    if (existing && existing.id) {
      const updated = await vapiClient.updateTool(existing.id, tool);
      results.push({ action: 'updated', tool: updated });
      console.log(`[ClientController] Updated tool: ${tool.function.name}`);
    } else {
      const created = await vapiClient.createTool(tool);
      results.push({ action: 'created', tool: created });
      console.log(`[ClientController] Created tool: ${tool.function.name}`);
    }
  }

  // Save tool IDs
  const toolIdMap: Record<string, string> = {};
  results.forEach((r: any) => {
    if (r.action !== 'error' && r.tool?.id) {
      toolIdMap[r.tool.function.name] = r.tool.id;
    }
  });

  const toolIdsPath = path.join(__dirname, '../config/tool-ids.json');
  fs.writeFileSync(toolIdsPath, JSON.stringify(toolIdMap, null, 2), 'utf8');

  console.log(`[ClientController] Tool IDs saved:`, toolIdMap);

  return { results, toolIdMap };
}

/**
 * Sync structured outputs to Vapi
 */
async function syncStructuredOutputs() {
  const existingOutputs = await vapiClient.listStructuredOutputs();
  const existing = existingOutputs.results.find(
    (o: any) => o.name === STRUCTURED_OUTPUT_SCHEMA.name
  );

  let result;
  if (existing && existing.id) {
    result = await vapiClient.updateStructuredOutput(existing.id, STRUCTURED_OUTPUT_SCHEMA);
  } else {
    result = await vapiClient.createStructuredOutput(STRUCTURED_OUTPUT_SCHEMA);
  }

  // Save ID
  const configPath = path.join(__dirname, '../config/structured-output-id.json');
  fs.writeFileSync(configPath, JSON.stringify({ id: result.id, name: result.name }, null, 2), 'utf8');

  return { action: existing ? 'updated' : 'created', id: result.id };
}

/**
 * Sync assistant for this client
 */
async function syncAssistant() {
  const client = await databaseService.getClientById(CLIENT_ID);

  if (!client) {
    throw new Error('Client configuration not found. Please save configuration first.');
  }

  const config = buildAssistantConfig(client);

  if (client.vapi_assistant_id) {
    // Update existing
    await vapiClient.updateAssistant(client.vapi_assistant_id, config);
    return { action: 'updated', assistantId: client.vapi_assistant_id };
  } else {
    // Create new
    const created = await vapiClient.createAssistant(config);
    await databaseService.updateClientAssistantId(CLIENT_ID, created.id!);
    return { action: 'created', assistantId: created.id };
  }
}

/**
 * Sync phone number configuration
 */
async function syncPhoneNumber() {
  const client = await databaseService.getClientConfig(CLIENT_ID);

  if (!client || !client.vapi_phone_number_id) {
    throw new Error('No phone number configured for this client');
  }

  if (!client.vapi_assistant_id) {
    throw new Error('No assistant ID found. Please sync assistant first.');
  }

  const SERVER_URL = (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');

  const config = {
    assistantId: client.vapi_assistant_id,
    serverUrl: `${SERVER_URL}/inbound`
  };

  await vapiClient.updatePhoneNumber(client.vapi_phone_number_id, config);

  return {
    action: 'updated',
    phoneNumber: client.phone_number,
    assistantId: client.vapi_assistant_id
  };
}
