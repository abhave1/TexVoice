// src/controllers/inbound.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { VapiPayload } from '../types';
import { customerService } from '../services/customer.service';
import { CONTACTS } from '../db/mock';

/**
 * Handle inbound call from Vapi
 * Recognizes customers and returns personalized configuration
 */
export async function handleInboundCall(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.body as VapiPayload;

  // Log errors and debugging artifacts from Vapi
  if (payload.message?.type === 'status-update' && payload.message?.status === 'ended') {
    const artifacts = (payload.message as any).inboundPhoneCallDebuggingArtifacts;
    if (artifacts) {
      console.error('[InboundCall] ❌ Call ended with error:');
      console.error('Error:', artifacts.error);
      console.error('Assistant Request Error:', artifacts.assistantRequestError);
      console.error('Assistant Response:', JSON.stringify(artifacts.assistantRequestResponse, null, 2));
    }
    return reply.send({ status: 'ok' });
  }

  const callerNumber = payload.message?.call?.customer?.number || "unknown";

  // Get greeting and system prompt from customer service
  const firstMessage = customerService.getPersonalizedGreeting(callerNumber);
  const systemPrompt = customerService.getSystemPrompt(callerNumber);

  // Return Vapi assistant configuration
  // NOTE: Tools must be synced to Vapi separately via API (run: npm run vapi:sync)
  // Then we reference them by ID here
  const response = {
    assistant: {
      model: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        temperature: 1,
        toolIds: ["42134fc1-af0f-4cf5-a947-3aa8d7cd50bc"],  // Reference synced tool
        messages: [
          { role: "system", content: systemPrompt }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "Jvx0SZHtelVH4bP2bPhY",
        stability: 0.5,
        similarityBoost: 0.75,
        optimizeStreamingLatency: 4,
        useSpeakerBoost: true
      },
      firstMessage: firstMessage
    }
  };

  return reply.send(response);
}
