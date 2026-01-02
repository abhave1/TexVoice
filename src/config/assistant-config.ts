// src/config/assistant-config.ts
import { customerService } from '../services/customer.service';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Dynamically load tool ID map
 */
function getToolIdMap(): Record<string, string> {
  const toolIdsPath = join(__dirname, './tool-ids.json');
  if (!existsSync(toolIdsPath)) {
    return {};
  }
  const content = readFileSync(toolIdsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Dynamically load structured output config
 */
function getStructuredOutputConfig(): { id: string; name: string } {
  const configPath = join(__dirname, './structured-output-id.json');
  if (!existsSync(configPath)) {
    // Return a placeholder if file doesn't exist
    return { id: '', name: '' };
  }
  const content = readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Interface for client database row
 */
interface ClientRow {
  id: string;
  name: string;
  custom_prompt: string | null;
  first_message_template: string | null;
  enable_inventory: number;
  enable_transfers: number;
}

/**
 * Build base assistant configuration shared by all clients
 * This includes model settings, voice, analysis plans, etc.
 */
export function buildBaseAssistantConfig() {
  const structuredOutputConfig = getStructuredOutputConfig();

  return {
    model: {
      provider: "anthropic" as const,
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,  // ZERO - prevent all hallucinations
    },
    voice: {
      provider: "11labs" as const,
      voiceId: "cgSgspJ2msm6clMCkdW9",
      model: "eleven_turbo_v2_5",
      stability: 0.5,
      similarityBoost: 0.75
    },
    transcriber: {
      provider: "deepgram" as const,
      model: "nova-3",
      language: "en",
      endpointing: 150
    },
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
        rubric: "NumericScale" as const,
        messages: [
          {
            role: "system" as const,
            content: "Rate this call's success from 1-10. Output ONLY a number (e.g., 8). Consider: Did we answer the customer's question? Did we route them correctly?"
          }
        ]
      }
    },
    artifactPlan: {
      recordingEnabled: true,
      videoRecordingEnabled: false,
      structuredOutputIds: structuredOutputConfig.id ? [structuredOutputConfig.id] : []
    },
    recordingEnabled: true,
    startSpeakingPlan: {
      waitSeconds: 0.4,
      smartEndpointingEnabled: true
    },
    backgroundDenoisingEnabled: false,
    serverMessages: [
      "conversation-update",
      "end-of-call-report",
      "status-update",
      "tool-calls",
      "function-call",
      "speech-update",
      "user-interrupted",
      "assistant.started"
    ]
  };
}

/**
 * Build system prompt with optional client-specific additions
 */
export function buildSystemPrompt(clientName: string, customPrompt?: string | null): Array<{ role: string; content: string }> {
  // Get base prompt from customer service with Vapi variable templates
  let systemPrompt = customerService.getSystemPrompt(clientName);

  // Append client-specific custom prompt if provided
  if (customPrompt) {
    systemPrompt += '\n\n' + customPrompt;
  }

  return [
    { role: "system", content: systemPrompt }
  ];
}

/**
 * Get filtered tool IDs based on client's enabled features
 */
export function getToolIdsForClient(
  clientId: string,
  enableInventory: boolean,
  enableTransfers: boolean
): string[] {
  const toolIdMap = getToolIdMap();
  const toolIds: string[] = [];

  if (enableInventory && toolIdMap.check_inventory) {
    toolIds.push(toolIdMap.check_inventory);
  }

  if (enableTransfers && toolIdMap.transfer_call) {
    toolIds.push(toolIdMap.transfer_call);
  }

  // schedule_callback is always available (for after-hours and explicit requests)
  if (toolIdMap.schedule_callback) {
    toolIds.push(toolIdMap.schedule_callback);
  }

  console.log(`[AssistantConfig] Tools for ${clientId}:`, {
    inventory: enableInventory ? 'enabled' : 'disabled',
    transfers: enableTransfers ? 'enabled' : 'disabled',
    callbacks: 'always enabled',
    toolCount: toolIds.length
  });

  return toolIds;
}

/**
 * Build complete assistant configuration for a client
 * This is used by the sync script to create/update assistants in VAPI
 */
export function buildAssistantConfig(client: ClientRow) {
  const baseConfig = buildBaseAssistantConfig();
  const systemPrompt = buildSystemPrompt(client.name, client.custom_prompt);
  const toolIds = getToolIdsForClient(
    client.id,
    Boolean(client.enable_inventory),
    Boolean(client.enable_transfers)
  );

  return {
    name: `${client.name} - Receptionist`,
    ...baseConfig,
    model: {
      ...baseConfig.model,
      toolIds,
      messages: systemPrompt
    },
    // Generic fallback - will be overridden by webhook
    firstMessage: `Thanks for calling ${client.name}. This is Tex, how can I help?`
  };
}
