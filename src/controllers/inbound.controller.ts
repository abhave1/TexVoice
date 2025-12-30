// src/controllers/inbound.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { VapiPayload } from '../types';
import { customerService } from '../services/customer.service';

/**
 * Handle inbound call from Vapi
 * Recognizes customers and returns personalized configuration
 */
export async function handleInboundCall(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.body as VapiPayload;
  const callerNumber = payload.message?.call?.customer?.number || "unknown";

  const recognized = customerService.isKnownCustomer(callerNumber);
  const customer = customerService.findByPhone(callerNumber);

  if (recognized && customer) {
    console.log(`[InboundCall] Recognized customer: ${customer.name} from ${customer.company} (${callerNumber})`);
  } else {
    console.log(`[InboundCall] Unknown caller: ${callerNumber}`);
  }

  // Get greeting and system prompt from customer service
  const firstMessage = customerService.getPersonalizedGreeting(callerNumber);
  const systemPrompt = customerService.getSystemPrompt(callerNumber);

  console.log(`[InboundCall] Configured assistant for ${callerNumber} - Greeting: "${firstMessage.substring(0, 50)}..."`);

  // Return Vapi assistant configuration
  return reply.send({
    assistant: {
      model: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt }
        ]
      },
      firstMessage: firstMessage
    }
  });
}
