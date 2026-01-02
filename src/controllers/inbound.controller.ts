// src/controllers/inbound.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import {VapiPayload, AssistantRequestMessage, StatusUpdateMessage, EndOfCallReportMessage } from '../types';
import { databaseService } from '../services/database.service';
import { buildDynamicContext, buildFirstMessage } from '../services/context-builder.service';

/**
 * Main webhook handler for VAPI inbound calls
 * Routes to specific handlers based on message type
 *
 * HYBRID APPROACH:
 * - Permanent assistant (stored in Vapi) provides base behavior
 * - Transient overrides (built per-call) provide dynamic context
 */
export async function handleInboundCall(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = request.body as VapiPayload;
    const messageType = payload.message?.type;

    if (!messageType) {
      console.error('[Inbound] No message type in payload:', JSON.stringify(payload));
      return reply.status(400).send({ error: 'No message type' });
    }

    // Route to appropriate handler based on message type
    switch (messageType) {
      case 'assistant-request':
        return handleAssistantRequest(payload.message as AssistantRequestMessage, reply);

      case 'assistant.started':
        return reply.send({ status: 'ok' });

      case 'status-update':
        return handleStatusUpdate(payload.message as StatusUpdateMessage, reply);

      case 'conversation-update':
        return reply.send({ status: 'ok' });

      case 'end-of-call-report':
        return handleEndOfCallReport(payload.message as EndOfCallReportMessage, reply);

      case 'speech-update':
        // Real-time speech transcription updates - can be used for live monitoring
        // No action needed for now, just acknowledge
        return reply.send({ status: 'ok' });

      default:
        return reply.send({ status: 'ok' });
    }
  } catch (error: any) {
    console.error('[Inbound] CRITICAL ERROR:', error.message);
    console.error('[Inbound] Stack:', error.stack);
    console.error('[Inbound] Payload:', JSON.stringify(request.body, null, 2));
    return reply.status(500).send({ error: 'Internal server error', details: error.message });
  }
}

/**
 * Handle initial assistant configuration request
 * HYBRID APPROACH:
 * - Returns permanent assistant ID (base behavior)
 * - Injects transient overrides (dynamic context, personalized greeting)
 */
async function handleAssistantRequest(message: AssistantRequestMessage, reply: FastifyReply) {
  const phoneNumberId = message.call.phoneNumberId;
  const callerNumber = message.call.customer?.number || 'unknown';
  const callId = message.call.id;

  console.log(`[AssistantRequest] Call ${callId} from ${callerNumber}`);

  try {
    // ========== STEP 1: Lookup client by phone number ==========
    const client = await databaseService.getClientByPhoneNumberId(phoneNumberId || '');

    if (!client) {
      console.error(`[AssistantRequest] No client found for phone ID: ${phoneNumberId}`);
      return reply.status(404).send({
        error: 'Client not found for this phone number'
      });
    }

    if (!client.vapi_assistant_id) {
      console.error(`[AssistantRequest] No assistant ID configured for client: ${client.id}`);
      console.error(`[AssistantRequest] Run: npm run vapi:sync-assistants -- --client=${client.id}`);
      return reply.status(500).send({
        error: 'Assistant not configured. Run sync script.',
        command: `npm run vapi:sync-assistants -- --client=${client.id}`
      });
    }

    console.log(`[AssistantRequest] Client: ${client.name} (${client.id})`);
    console.log(`[AssistantRequest] Assistant: ${client.vapi_assistant_id}`);

    // ========== STEP 2: Get caller history ==========
    const callerHistory = await databaseService.getContact(callerNumber);

    if (callerHistory) {
      console.log(`[AssistantRequest] Caller: ${callerHistory.name} from ${callerHistory.company}`);
      console.log(`[AssistantRequest] Status: ${callerHistory.status}, Total calls: ${callerHistory.total_calls}`);
    } else {
      console.log(`[AssistantRequest] New caller: ${callerNumber}`);
    }

    // ========== STEP 3: Build dynamic context ==========
    console.log(`[AssistantRequest] 🔨 Building dynamic context...`);
    const { contextMessage: dynamicContext, isAfterHours } = await buildDynamicContext({
      callerPhone: callerNumber,
      clientId: client.id,
      phoneNumberId: phoneNumberId || ''
    });

    console.log(`[AssistantRequest] Dynamic context built (${dynamicContext.length} chars)`);
    console.log(`[AssistantRequest] 🕐 After hours: ${isAfterHours ? 'YES (callbacks only)' : 'NO (transfers available)'}`);

    // ========== STEP 4: Build personalized first message ==========
    const firstMessage = buildFirstMessage(
      client.name,
      callerHistory ? {
        name: callerHistory.name,
        company: callerHistory.company,
        status: callerHistory.status
      } : null,
      isAfterHours
    );

    console.log(`[AssistantRequest] 💬 First message: "${firstMessage}"`);

    // ========== STEP 5: Return hybrid configuration ==========
    const response = {
      assistantId: client.vapi_assistant_id, // PERMANENT: Pre-created assistant
      assistantOverrides: { // TRANSIENT: Dynamic per-call overrides
        firstMessage,
        model: {
          provider: 'groq',
          model: 'llama3-70b-8192', // Must match permanent assistant's model
          messages: [
            {
              role: 'system',
              content: dynamicContext // Real-time context injection
            }
          ]
        }
      }
    };

    return reply.send(response);

  } catch (error: any) {
    console.error(`[AssistantRequest] Error:`, error.message);
    console.error(error.stack);
    return reply.status(500).send({
      error: 'Failed to load assistant configuration',
      details: error.message
    });
  }
}

/**
 * Handle call status updates
 * Logs status changes and errors
 */
function handleStatusUpdate(message: StatusUpdateMessage, reply: FastifyReply) {
  console.log(`[StatusUpdate] Status: ${message.status}`);

  // Log errors if call ended with issues
  if (message.status === 'ended' && message.inboundPhoneCallDebuggingArtifacts) {
    const artifacts = message.inboundPhoneCallDebuggingArtifacts;
    console.error('[StatusUpdate] Call ended with error:');
    console.error('Error:', artifacts.error);
    console.error('Assistant Request Error:', artifacts.assistantRequestError);
    console.error('Assistant Response:', JSON.stringify(artifacts.assistantRequestResponse, null, 2));
  }

  return reply.send({ status: 'ok' });
}


/**
 * Handle end-of-call report
 * Extracts and saves call data to database
 */
async function handleEndOfCallReport(message: EndOfCallReportMessage, reply: FastifyReply) {
  // Extract structured data from artifact
  let structuredData = null;

  if ((message as any).artifact?.structuredOutputs) {
    const structuredOutputs = (message as any).artifact.structuredOutputs;

    // structuredOutputs is an object keyed by structured output ID
    // Get the first structured output (or use the known ID)
    const structuredOutputValues = Object.values(structuredOutputs);

    if (structuredOutputValues.length > 0) {
      const structuredOutput: any = structuredOutputValues[0];
      if (!structuredOutput.error && structuredOutput.result) {
        structuredData = structuredOutput.result;
      }
    }
  }

  // Save to database
  try {
    // Parse success score if it's a string like "8/10"
    let successScore: number | undefined;
    if (message.analysis?.successEvaluation) {
      const score = message.analysis.successEvaluation.toString();
      const match = score.match(/(\d+)/);
      if (match) {
        successScore = parseInt(match[1]);
      }
    }

    // Save call record
    await databaseService.saveCall({
      id: message.call.id,
      phoneNumberId: (message as any).call?.phoneNumberId,
      callerPhone: (message as any).call?.customer?.number,
      callType: (message as any).call?.type,
      startedAt: message.call.startedAt,
      endedAt: message.call.endedAt,
      status: message.call.status,
      endedReason: message.call.endedReason,
      transcript: message.transcript,
      summary: message.summary,
      recordingUrl: message.recordingUrl,
      stereoRecordingUrl: message.stereoRecordingUrl,
      successScore,
      cost: message.cost,
      costBreakdown: message.costBreakdown
    });

    // Save structured data if available
    if (structuredData) {
      await databaseService.saveStructuredData(
        message.call.id,
        structuredData
      );

      // Update contact if we have caller info
      const callerPhone = structuredData.caller?.phone || (message as any).call?.customer?.number;

      if (callerPhone) {
        const machineMention = structuredData.machine?.make && structuredData.machine?.model
          ? `${structuredData.machine.make} ${structuredData.machine.model}`
          : structuredData.machine?.category || null;

        await databaseService.updateContact(callerPhone, {
          name: structuredData.caller?.name,
          company: structuredData.caller?.company,
          email: structuredData.caller?.email,
          lastMachine: machineMention
        });
      }
    }
  } catch (error: any) {
    console.error(`[Database] Failed to save call data:`, error.message);
    // Don't fail the webhook if database save fails
  }

  return reply.send({ status: 'ok' });
}
