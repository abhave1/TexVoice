#!/usr/bin/env tsx
// scripts/sync-vapi.ts
// Sync local Vapi configuration to the cloud

// IMPORTANT: Load env vars FIRST before any other imports
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { vapiClient } from '../src/services/vapi-client.service';
import { databaseService } from '../src/services/database.service';
import { buildAssistantConfig } from '../src/config/assistant-config';
import { getAllStaticTools, STRUCTURED_OUTPUT_SCHEMA } from '../src/config/tools-builder';

async function syncTools() {
  console.log('Syncing static tools to Vapi...\n');
  console.log('Tools are shared across all clients');
  console.log('Client-specific data (phone numbers, inventory) loaded from DB at runtime\n');

  const results: Array<{ action: string; tool?: any; error?: string }> = [];

  // Get ALL static tools (not client-specific)
  const staticTools = getAllStaticTools();

  // Fetch existing tools ONCE before the loop
  const existingTools = await vapiClient.listTools();

  for (const tool of staticTools) {
    try {
      console.log(`Processing tool: ${tool.function.name}`);

      // Find existing tool by name
      const existing = existingTools.results.find(
        t => t.function.name === tool.function.name
      );

      if (existing && existing.id) {
        // Update existing tool
        console.log(`   ↻ Updating existing tool (ID: ${existing.id})`);
        const updated = await vapiClient.updateTool(existing.id, tool);
        results.push({ action: 'updated', tool: updated });
        console.log(`   Updated successfully\n`);
      } else {
        // Create new tool
        console.log(`   + Creating new tool`);
        const created = await vapiClient.createTool(tool);
        results.push({ action: 'created', tool: created });
        console.log(`   Created successfully (ID: ${created.id})\n`);
      }
    } catch (error: any) {
      console.error(`   Error: ${error.message}\n`);
      results.push({ action: 'error', tool: tool.function.name, error: error.message });
    }
  }

  // Summary
  console.log('━'.repeat(50));
  console.log('Sync Summary:');
  console.log(`   Total tools: ${staticTools.length}`);
  console.log(`   Created: ${results.filter(r => r.action === 'created').length}`);
  console.log(`   Updated: ${results.filter(r => r.action === 'updated').length}`);
  console.log(`   Errors: ${results.filter(r => r.action === 'error').length}`);
  console.log('━'.repeat(50));

  // Save tool IDs to file for runtime use
  const toolIdMap: Record<string, string> = {};
  results.forEach(r => {
    if (r.action !== 'error' && r.tool && typeof r.tool === 'object' && r.tool.id && r.tool.function) {
      toolIdMap[r.tool.function.name] = r.tool.id;
    }
  });

  const toolIdsPath = path.join(__dirname, '../src/config/tool-ids.json');
  fs.writeFileSync(toolIdsPath, JSON.stringify(toolIdMap, null, 2), 'utf8');
  console.log(`\nSaved tool IDs to: src/config/tool-ids.json`);
  console.log(JSON.stringify(toolIdMap, null, 2));

  return { results, toolIdMap };
}

async function syncPhoneNumbers() {
  console.log('Syncing phone numbers to Vapi...\n');

  const results: Array<{ action: string; number?: string; client?: string; assistantId?: string; error?: string }> = [];
  const SERVER_URL = (process.env.SERVER_URL || 'https://texintel.com').replace(/\/$/, '');

  try {
    // Fetch all phone numbers from VAPI
    const phoneNumbersResponse = await vapiClient.listPhoneNumbers();
    const phoneNumbers = phoneNumbersResponse.results || [];

    if (phoneNumbers.length === 0) {
      console.log('   No phone numbers found in Vapi');
      console.log('   Buy phone numbers in the Vapi dashboard first\n');
      return results;
    }

    console.log(`   Found ${phoneNumbers.length} phone number(s)\n`);

    // Ensure database is initialized
    await databaseService.init();

    for (const phoneNumber of phoneNumbers) {
      try {
        const number = phoneNumber.number;
        const phoneNumberId = phoneNumber.id;
        console.log(`Processing: ${number} (ID: ${phoneNumberId})`);

        // Look up which client owns this phone number
        const client = await databaseService.getClientByPhoneNumberId(phoneNumberId);

        if (!client) {
          console.log(`   No client mapping found in database`);
          console.log(`   Add to client_phone_numbers table or it will use default client`);
          console.log(`   Skipping...\n`);
          continue;
        }

        console.log(`   → Client: ${client.name} (${client.id})`);

        // Check if client has an assistant ID
        if (!client.vapi_assistant_id) {
          console.log(`   Client has no assistant ID configured`);
          console.log(`   Run: npm run vapi:sync-assistants -- --client=${client.id}`);
          console.log(`   Skipping...\n`);
          continue;
        }

        console.log(`   → Assistant ID: ${client.vapi_assistant_id}`);

        // Update phone number to use this assistant
        console.log(`   ↻ Updating phone number configuration...`);
        const config = {
          assistantId: client.vapi_assistant_id,
          serverUrl: `${SERVER_URL}/inbound`
        };

        await vapiClient.updatePhoneNumber(phoneNumberId, config);

        results.push({ action: 'updated', number, client: client.name, assistantId: client.vapi_assistant_id });
        console.log(`   Updated successfully`);
        console.log(`      Assistant ID: ${client.vapi_assistant_id}`);
        console.log(`      Server URL: ${config.serverUrl}\n`);

        // Save phone number mapping to database for future lookups
        await databaseService.addClientPhoneNumber(client.id, phoneNumberId, number);

      } catch (error: any) {
        console.error(`   Error updating ${phoneNumber.number}: ${error.message}\n`);
        results.push({ action: 'error', number: phoneNumber.number, error: error.message });
      }
    }

    // Summary
    console.log('━'.repeat(50));
    console.log('Phone Number Sync Summary:');
    console.log(`   Total numbers: ${phoneNumbers.length}`);
    console.log(`   Updated: ${results.filter(r => r.action === 'updated').length}`);
    console.log(`   Skipped: ${phoneNumbers.length - results.filter(r => r.action === 'updated' || r.action === 'error').length}`);
    console.log(`   Errors: ${results.filter(r => r.action === 'error').length}`);
    console.log('━'.repeat(50));

  } catch (error: any) {
    console.error(`Failed to sync phone numbers: ${error.message}`);
    throw error;
  }

  return results;
}

async function syncStructuredOutputs() {
  console.log('Syncing structured outputs to Vapi...\n');

  try {
    console.log(`Processing structured output: ${STRUCTURED_OUTPUT_SCHEMA.name}`);

    // Try to find existing structured output by name
    const existingOutputs = await vapiClient.listStructuredOutputs();
    const existing = existingOutputs.results.find(
      (o: any) => o.name === STRUCTURED_OUTPUT_SCHEMA.name
    );

    if (existing && existing.id) {
      // Update existing
      console.log(`   ↻ Updating existing structured output (ID: ${existing.id})`);
      const updated = await vapiClient.updateStructuredOutput(existing.id, STRUCTURED_OUTPUT_SCHEMA);
      console.log(`   ✅ Updated successfully`);
      console.log(`   ID: ${updated.id}\n`);

      // Save ID to .env or show it for manual config
      console.log('━'.repeat(50));
      console.log('IMPORTANT: Copy this ID to use in your assistant config:');
      console.log(`   Structured Output ID: ${updated.id}`);
      console.log('━'.repeat(50));

      // Save to config file
      const configPath = path.join(__dirname, '../src/config/structured-output-id.json');
      fs.writeFileSync(configPath, JSON.stringify({ id: updated.id, name: updated.name }, null, 2), 'utf8');

      return { action: 'updated', id: updated.id };
    } else {
      // Create new
      console.log(`   + Creating new structured output`);
      const created = await vapiClient.createStructuredOutput(STRUCTURED_OUTPUT_SCHEMA);
      console.log(`   Created successfully`);
      console.log(`   ID: ${created.id}\n`);

      // Save ID to .env or show it for manual config
      console.log('━'.repeat(50));
      console.log('IMPORTANT: Copy this ID to use in your assistant config:');
      console.log(`   Structured Output ID: ${created.id}`);
      console.log('━'.repeat(50));

      // Save to config file
      const configPath = path.join(__dirname, '../src/config/structured-output-id.json');
      fs.writeFileSync(configPath, JSON.stringify({ id: created.id, name: created.name }, null, 2), 'utf8');

      return { action: 'created', id: created.id };
    }
  } catch (error: any) {
    console.error(`   Error: ${error.message}\n`);
    throw error;
  }
}

/**
 * Sync assistants to VAPI
 * Creates or updates assistants for clients based on their configuration
 */
async function syncAssistants(clientFilter?: string) {
  console.log('Syncing assistants to Vapi...\n');

  try {
    // Initialize database
    await databaseService.init();

    // Load clients (all or filtered by ID)
    const clients = clientFilter
      ? [await databaseService.getClientById(clientFilter)]
      : await databaseService.getAllClients();

    if (!clients || clients.length === 0 || (clients.length === 1 && !clients[0])) {
      console.error(`No clients found${clientFilter ? ` with ID: ${clientFilter}` : ''}`);
      return;
    }

    console.log(`Found ${clients.length} client(s) to sync\n`);

    for (const client of clients) {
      if (!client) continue;

      try {
        console.log(`\nProcessing client: ${client.name} (${client.id})`);

        // Build assistant config
        const config = buildAssistantConfig(client);

        if (client.vapi_assistant_id) {
          // Update existing assistant
          console.log(`   ↻ Updating assistant ${client.vapi_assistant_id}`);
          await vapiClient.updateAssistant(client.vapi_assistant_id, config);
          console.log(`   Updated successfully`);
        } else {
          // Create new assistant
          console.log(`   + Creating new assistant`);
          const created = await vapiClient.createAssistant(config);
          await databaseService.updateClientAssistantId(client.id, created.id!);
          console.log(`   Created successfully (ID: ${created.id})`);
        }
      } catch (error: any) {
        console.error(`   Error: ${error.message}`);
      }
    }

    console.log('\nAssistant sync complete');
  } catch (error: any) {
    console.error(`Failed to sync assistants: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║      Vapi Configuration Sync Tool             ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');

  // Check for API key
  if (!process.env.VAPI_API_KEY) {
    console.error('Error: VAPI_API_KEY not found in environment variables');
    console.error('   Please set it in your .env file');
    process.exit(1);
  }

  try {
    // Parse CLI args for client filter
    const args = process.argv.slice(2);
    const clientArg = args.find(arg => arg.startsWith('--client='));
    const clientFilter = clientArg ? clientArg.split('=')[1] : undefined;

    if (clientFilter) {
      console.log(`Syncing for client: ${clientFilter}\n`);
    }

    // Sync tools FIRST (assistants depend on tool IDs)
    await syncTools();
    console.log('');

    // Sync structured outputs (assistants depend on structured output IDs)
    await syncStructuredOutputs();
    console.log('');

    // Sync assistants (NEW)
    await syncAssistants(clientFilter);
    console.log('');

    // Sync phone numbers
    await syncPhoneNumbers();

    console.log('\nAll Vapi configuration synced successfully!');
    console.log('\nConfig files updated:');
    console.log('   - src/config/tool-ids.json');
    console.log('   - src/config/structured-output-id.json');
    console.log('\nIDs are auto-loaded by the inbound controller - no manual copying needed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\nSync failed:', error.message);
    process.exit(1);
  }
}

main();
