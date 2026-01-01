#!/usr/bin/env tsx
// scripts/onboard-client.ts

/**
 * Client Onboarding Script
 *
 * Creates a new client in the system with:
 * 1. Database record (client config, phone mapping)
 * 2. Vapi phone number (imported or new)
 * 3. Permanent assistant in Vapi
 * 4. Tool configuration
 *
 * Usage:
 *   npm run onboard -- --name="Phoenix Heavy Equipment" --phone="+14805551234"
 *
 *   Or interactive:
 *   npm run onboard
 */

import { databaseService } from '../src/services/database.service';
import { vapiClient } from '../src/services/vapi-client.service';
import { buildAssistantConfig } from '../src/config/assistant-config';
import { getAllStaticTools } from '../src/config/tools-builder';
import * as readline from 'readline';

interface OnboardingData {
  id: string;
  name: string;
  company?: string;
  phoneNumber?: string;
  vapiPhoneNumberId?: string;
  salesPhone?: string;
  servicePhone?: string;
  partsPhone?: string;
  rentalsPhone?: string;
  billingPhone?: string;
  customPrompt?: string;
  firstMessageTemplate?: string;
  enableInventory: boolean;
  enableTransfers: boolean;
}

/**
 * Interactive prompt helper
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<OnboardingData> {
  const args = process.argv.slice(2);
  const data: Partial<OnboardingData> = {};

  for (const arg of args) {
    if (arg.startsWith('--name=')) {
      data.name = arg.split('=')[1].replace(/"/g, '');
    } else if (arg.startsWith('--phone=')) {
      data.phoneNumber = arg.split('=')[1].replace(/"/g, '');
    } else if (arg.startsWith('--id=')) {
      data.id = arg.split('=')[1].replace(/"/g, '');
    } else if (arg.startsWith('--sales=')) {
      data.salesPhone = arg.split('=')[1].replace(/"/g, '');
    } else if (arg.startsWith('--service=')) {
      data.servicePhone = arg.split('=')[1].replace(/"/g, '');
    } else if (arg.startsWith('--parts=')) {
      data.partsPhone = arg.split('=')[1].replace(/"/g, '');
    }
  }

  return data;
}

/**
 * Generate client ID from name
 */
function generateClientId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

/**
 * Collect onboarding data interactively
 */
async function collectOnboardingData(initialData: Partial<OnboardingData>): Promise<OnboardingData> {
  console.log('\n=== TEX INTEL CLIENT ONBOARDING ===\n');

  const name = initialData.name || await prompt('Client Name (e.g., Phoenix Heavy Equipment): ');
  const id = initialData.id || generateClientId(name);

  console.log(`\nGenerated Client ID: ${id}`);

  const company = await prompt('Company Legal Name (optional, press enter to skip): ');

  console.log('\n--- Phone Configuration ---');
  const phoneNumber = initialData.phoneNumber || await prompt('Inbound Phone Number (e.g., +14805551234, or press enter to buy new): ');

  console.log('\n--- Transfer Destinations ---');
  const salesPhone = initialData.salesPhone || await prompt('Sales Department Phone (e.g., +14805551234): ');
  const servicePhone = initialData.servicePhone || await prompt('Service Department Phone: ');
  const partsPhone = initialData.partsPhone || await prompt('Parts Department Phone: ');
  const rentalsPhone = await prompt('Rentals Department Phone (optional): ');
  const billingPhone = await prompt('Billing Department Phone (optional): ');

  console.log('\n--- Customization (optional) ---');
  const customPrompt = await prompt('Custom System Prompt Additions (press enter to skip): ');
  const firstMessageTemplate = await prompt('First Message Template (press enter for default): ');

  const enableInventoryStr = await prompt('Enable inventory tool? (y/n, default: y): ');
  const enableInventory = enableInventoryStr.toLowerCase() !== 'n';

  const enableTransfersStr = await prompt('Enable call transfers? (y/n, default: y): ');
  const enableTransfers = enableTransfersStr.toLowerCase() !== 'n';

  return {
    id,
    name,
    company: company || undefined,
    phoneNumber: phoneNumber || undefined,
    salesPhone: salesPhone || undefined,
    servicePhone: servicePhone || undefined,
    partsPhone: partsPhone || undefined,
    rentalsPhone: rentalsPhone || undefined,
    billingPhone: billingPhone || undefined,
    customPrompt: customPrompt || undefined,
    firstMessageTemplate: firstMessageTemplate || undefined,
    enableInventory,
    enableTransfers
  };
}

/**
 * Ensure tools are synced to Vapi
 */
async function ensureToolsExist(): Promise<Record<string, string>> {
  console.log('\n[1/5] Checking tools in Vapi...');

  const tools = getAllStaticTools();
  const toolIdMap: Record<string, string> = {};

  for (const tool of tools) {
    const toolName = tool.function.name;

    // Check if tool exists
    const existingTools = await vapiClient.listTools();
    const existingTool = existingTools.results.find(
      (t: any) => t.function?.name === toolName
    );

    if (existingTool && existingTool.id) {
      console.log(`  Tool "${toolName}" exists: ${existingTool.id}`);
      toolIdMap[toolName] = existingTool.id;
    } else {
      console.log(`  🔨 Creating tool "${toolName}"...`);
      const created = await vapiClient.createTool(tool);
      if (created.id) {
        console.log(`  Created: ${created.id}`);
        toolIdMap[toolName] = created.id;
      }
    }
  }

  return toolIdMap;
}

/**
 * Handle phone number (import existing or buy new)
 */
async function handlePhoneNumber(phoneNumber?: string): Promise<{ id: string; number: string }> {
  console.log('\n[2/5] Setting up phone number...');

  if (phoneNumber) {
    // Check if we already have this number in Vapi
    const phoneNumbers = await vapiClient.listPhoneNumbers();
    const existingPhone = phoneNumbers.results.find(
      (p: any) => p.number === phoneNumber
    );

    if (existingPhone) {
      console.log(`  Phone number exists in Vapi: ${existingPhone.id}`);
      return {
        id: existingPhone.id,
        number: existingPhone.number
      };
    }

    // Import existing number (requires Vapi configuration)
    console.log(`  Phone number ${phoneNumber} not found in Vapi.`);
    console.log(`  You'll need to import this number via Vapi dashboard first.`);
    console.log(`  🔗 https://dashboard.vapi.ai/phone-numbers`);
    throw new Error('Phone number not found in Vapi. Please import it first.');
  }

  // Buy a new number
  console.log('  No phone number provided. You can buy one via Vapi dashboard.');
  console.log('  🔗 https://dashboard.vapi.ai/phone-numbers');
  throw new Error('Phone number required. Please provide one or buy via Vapi dashboard.');
}

/**
 * Create permanent assistant in Vapi
 */
async function createAssistant(
  client: OnboardingData,
  toolIdMap: Record<string, string>
): Promise<string> {
  console.log('\n[3/5] Creating permanent assistant in Vapi...');

  // Build assistant configuration
  const assistantConfig = buildAssistantConfig({
    id: client.id,
    name: client.name,
    custom_prompt: client.customPrompt || null,
    first_message_template: client.firstMessageTemplate || null,
    enable_inventory: client.enableInventory ? 1 : 0,
    enable_transfers: client.enableTransfers ? 1 : 0
  });

  // Add tool IDs from map
  const toolIds: string[] = [];
  if (client.enableInventory && toolIdMap.check_inventory) {
    toolIds.push(toolIdMap.check_inventory);
  }
  if (client.enableTransfers && toolIdMap.transfer_call) {
    toolIds.push(toolIdMap.transfer_call);
  }

  if (assistantConfig.model) {
    (assistantConfig.model as any).toolIds = toolIds;
  }

  // Create in Vapi
  const assistant = await vapiClient.createAssistant(assistantConfig);

  if (!assistant.id) {
    throw new Error('Failed to create assistant - no ID returned');
  }

  console.log(`  Assistant created: ${assistant.id}`);
  console.log(`  Name: ${assistant.name}`);
  console.log(`  Tools: ${toolIds.length} enabled`);

  return assistant.id;
}

/**
 * Save client to database
 */
async function saveClientToDatabase(
  client: OnboardingData,
  assistantId: string,
  phoneId: string,
  phoneNumber: string
): Promise<void> {
  console.log('\n[4/5] Saving client to database...');

  await databaseService.upsertClient({
    id: client.id,
    name: client.name,
    company: client.company,
    salesPhone: client.salesPhone,
    servicePhone: client.servicePhone,
    partsPhone: client.partsPhone,
    customPrompt: client.customPrompt,
    firstMessageTemplate: client.firstMessageTemplate,
    enableInventory: client.enableInventory,
    enableTransfers: client.enableTransfers
  });

  console.log(`  Client saved: ${client.id}`);

  // Update assistant ID
  await databaseService.updateClientAssistantId(client.id, assistantId);
  console.log(`  Assistant linked: ${assistantId}`);

  // Map phone number
  await databaseService.addClientPhoneNumber(client.id, phoneId, phoneNumber);
  console.log(`  Phone mapped: ${phoneNumber} → ${client.id}`);
}

/**
 * Configure phone number webhook
 */
async function configurePhoneWebhook(phoneId: string): Promise<void> {
  console.log('\n[5/5] Configuring phone number webhook...');

  const serverUrl = process.env.SERVER_URL;
  if (!serverUrl) {
    console.log('  WARNING: SERVER_URL not set in .env');
    console.log('  You\'ll need to configure the webhook manually');
    return;
  }

  await vapiClient.updatePhoneNumber(phoneId, {
    serverUrl: `${serverUrl}/inbound`,
    serverUrlSecret: process.env.VAPI_SERVER_SECRET || 'your-secret-here'
  });

  console.log(`  Webhook configured: ${serverUrl}/inbound`);
}

/**
 * Main onboarding flow
 */
async function main() {
  try {
    // Initialize database
    await databaseService.init();

    // Parse CLI args
    const cliData = parseArgs();

    // Collect remaining data interactively
    const client = await collectOnboardingData(cliData);

    console.log('\n=== REVIEW ===');
    console.log(JSON.stringify(client, null, 2));
    const confirm = await prompt('\nProceed with onboarding? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('Onboarding cancelled.');
      process.exit(0);
    }

    // Execute onboarding steps
    const toolIdMap = await ensureToolsExist();

    const phone = await handlePhoneNumber(client.phoneNumber);

    const assistantId = await createAssistant(client, toolIdMap);

    await saveClientToDatabase(client, assistantId, phone.id, phone.number);

    await configurePhoneWebhook(phone.id);

    console.log('\n=== ONBOARDING COMPLETE ===\n');
    console.log(`Client ID: ${client.id}`);
    console.log(`Assistant ID: ${assistantId}`);
    console.log(`Phone: ${phone.number}`);
    console.log(`\nThe client is now ready to receive calls!`);
    console.log(`\nTest by calling: ${phone.number}`);

  } catch (error: any) {
    console.error('\nONBOARDING FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

main();
