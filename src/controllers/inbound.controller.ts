// src/controllers/inbound.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  VapiPayload,
  AssistantRequestMessage,
  StatusUpdateMessage,
  ConversationUpdateMessage,
  EndOfCallReportMessage
} from '../types';
import { customerService } from '../services/customer.service';

/**
 * Main webhook handler for VAPI inbound calls
 * Routes to specific handlers based on message type
 */
export async function handleInboundCall(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = request.body as VapiPayload;
    const messageType = payload.message?.type;

    if (!messageType) {
      console.error('[Inbound] ❌ No message type in payload:', JSON.stringify(payload));
      return reply.status(400).send({ error: 'No message type' });
    }

    console.log(`[Inbound] Received message type: ${messageType}`);

    // Route to appropriate handler based on message type
    switch (messageType) {
      case 'assistant-request':
        return handleAssistantRequest(payload.message as AssistantRequestMessage, reply);

      case 'status-update':
        return handleStatusUpdate(payload.message as StatusUpdateMessage, reply);

      case 'conversation-update':
        return handleConversationUpdate(payload.message as ConversationUpdateMessage, reply);

      case 'end-of-call-report':
        return handleEndOfCallReport(payload.message as EndOfCallReportMessage, reply);

      default:
        console.log(`[Inbound] Unknown message type: ${messageType}`);
        return reply.send({ status: 'ok' });
    }
  } catch (error: any) {
    console.error('[Inbound] ❌ CRITICAL ERROR:', error.message);
    console.error('[Inbound] Stack:', error.stack);
    console.error('[Inbound] Payload:', JSON.stringify(request.body, null, 2));
    return reply.status(500).send({ error: 'Internal server error', details: error.message });
  }
}

/**
 * Handle initial assistant configuration request
 * Returns personalized assistant config based on caller
 */
function handleAssistantRequest(message: AssistantRequestMessage, reply: FastifyReply) {
  const callerNumber = message.call.customer?.number || 'unknown';

  console.log(`[AssistantRequest] Call from: ${callerNumber} (ID: ${message.call.id})`);

  // Get personalized greeting and system prompt
  const firstMessage = customerService.getPersonalizedGreeting(callerNumber);
  const systemPrompt = customerService.getSystemPrompt(callerNumber);

  // Return VAPI assistant configuration
  const response = {
    assistant: {
      model: {
        provider: "anthropic" as const,
        model: "claude-haiku-4-5-20251001",
        temperature: 0.7,

        // Reference pre-created tools by ID
        // NOTE: Tools with server callbacks MUST be pre-created in VAPI
        // Run: npm run vapi:sync to create/update tools
        toolIds: ["42134fc1-af0f-4cf5-a947-3aa8d7cd50bc"], // check_inventory

        messages: [
          { role: "system" as const, content: systemPrompt }
        ]
      },
      voice: {
        provider: "11labs" as const,
        voiceId: "Jvx0SZHtelVH4bP2bPhY",
        stability: 0.5,
        similarityBoost: 0.75,
        optimizeStreamingLatency: 4,
        useSpeakerBoost: true
      },
      firstMessage,

      // Enable analysis and artifacts
      analysisPlan: {
        summaryPlan: {
          enabled: true,
          messages: [
            {
              role: "system" as const,
              content: "Summarize this call in 2-3 sentences. Include: equipment discussed, customer intent (inquiry/rental/service), and outcome (answered/transferred/pending)."
            }
          ]
        },
        successEvaluationPlan: {
          enabled: true,
          rubric: "NumericScale",
          messages: [
            {
              role: "system" as const,
              content: "Rate this call's success from 1-10. Consider: Did we answer the customer's question? Did we route them correctly? Was the interaction professional and helpful?"
            }
          ]
        }
      },

      // Enable call recordings and structured data
      artifactPlan: {
        recordingEnabled: true,
        videoRecordingEnabled: false
      },

      // Tell VAPI what messages to send to our webhook
      serverMessages: [
        "conversation-update",
        "end-of-call-report",
        "status-update"
      ]
    }
  };

  console.log(`[AssistantRequest] Returning config for ${callerNumber}`);
  return reply.send(response);
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
    console.error('[StatusUpdate] ❌ Call ended with error:');
    console.error('Error:', artifacts.error);
    console.error('Assistant Request Error:', artifacts.assistantRequestError);
    console.error('Assistant Response:', JSON.stringify(artifacts.assistantRequestResponse, null, 2));
  }

  return reply.send({ status: 'ok' });
}

/**
 * Handle real-time conversation updates
 * Receives transcript as the conversation progresses
 */
function handleConversationUpdate(message: ConversationUpdateMessage, reply: FastifyReply) {
  const callId = message.call?.id || 'unknown';
  const messageCount = message.conversation.length;

  console.log(`[ConversationUpdate] Call ${callId} - ${messageCount} messages`);

  // Log last message for debugging
  if (messageCount > 0) {
    const lastMessage = message.conversation[messageCount - 1];
    console.log(`[ConversationUpdate] Last: [${lastMessage.role}] ${lastMessage.message?.substring(0, 100)}`);
  }

  // TODO: Store conversation updates in database for real-time monitoring

  return reply.send({ status: 'ok' });
}

/**
 * Handle end-of-call report
 * This is the GOLD - contains summary, analysis, transcript, recording, cost
 */
function handleEndOfCallReport(message: EndOfCallReportMessage, reply: FastifyReply) {
  const callId = message.call.id;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 END OF CALL REPORT - ${callId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Log call details
  console.log(`Status: ${message.call.status}`);
  console.log(`Ended Reason: ${message.call.endedReason}`);

  if (message.call.startedAt && message.call.endedAt) {
    const duration = (new Date(message.call.endedAt).getTime() - new Date(message.call.startedAt).getTime()) / 1000;
    console.log(`Duration: ${duration.toFixed(0)}s`);
  }

  // Log summary and analysis
  if (message.summary) {
    console.log(`\n📝 Summary:\n${message.summary}`);
  }

  if (message.analysis) {
    console.log(`\n🔍 Analysis:`);
    if (message.analysis.successEvaluation) {
      console.log(`Success: ${message.analysis.successEvaluation}`);
    }
    if (message.analysis.structuredData) {
      console.log(`Structured Data:`, JSON.stringify(message.analysis.structuredData, null, 2));
    }
  }

  // Log cost
  if (message.cost) {
    console.log(`\n💰 Cost: $${message.cost.toFixed(4)}`);
    if (message.costBreakdown) {
      console.log(`Breakdown:`, JSON.stringify(message.costBreakdown, null, 2));
    }
  }

  // Log recording URL
  if (message.recordingUrl) {
    console.log(`\n🎙️ Recording: ${message.recordingUrl}`);
  }

  // Log transcript (truncated)
  if (message.transcript) {
    const truncated = message.transcript.length > 500
      ? message.transcript.substring(0, 500) + '...'
      : message.transcript;
    console.log(`\n📜 Transcript:\n${truncated}`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TODO: Save to database
  // await db.calls.insert({
  //   callId,
  //   transcript: message.transcript,
  //   summary: message.summary,
  //   analysis: message.analysis,
  //   cost: message.cost,
  //   recordingUrl: message.recordingUrl,
  //   endedAt: message.call.endedAt
  // });

  return reply.send({ status: 'ok' });
}
