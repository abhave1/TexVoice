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
  console.log('Syncing tools...');

  const results: Array<{ action: string; tool?: any; error?: string }> = [];
  const staticTools = getAllStaticTools();
  const existingTools = await vapiClient.listTools();

  for (const tool of staticTools) {
    try {
      const existing = existingTools.results.find(
        t => t.function.name === tool.function.name
      );

      if (existing && existing.id) {
        const updated = await vapiClient.updateTool(existing.id, tool);
        results.push({ action: 'updated', tool: updated });
      } else {
        const created = await vapiClient.createTool(tool);
        results.push({ action: 'created', tool: created });
        console.log(`  ✓ Created: ${tool.function.name}`);
      }
    } catch (error: any) {
      console.error(`  ✗ Error syncing ${tool.function.name}: ${error.message}`);
      results.push({ action: 'error', tool: tool.function.name, error: error.message });
    }
  }

  const created = results.filter(r => r.action === 'created').length;
  const updated = results.filter(r => r.action === 'updated').length;
  const errors = results.filter(r => r.action === 'error').length;

  if (created > 0 || errors > 0) {
    console.log(`  ${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''}`);
  } else {
    console.log(`  ✓ ${updated} tools synced`);
  }

  // Save tool IDs to file for runtime use
  const toolIdMap: Record<string, string> = {};
  results.forEach(r => {
    if (r.action !== 'error' && r.tool && typeof r.tool === 'object' && r.tool.id && r.tool.function) {
      toolIdMap[r.tool.function.name] = r.tool.id;
    }
  });

  const toolIdsPath = path.join(__dirname, '../src/config/tool-ids.json');
  fs.writeFileSync(toolIdsPath, JSON.stringify(toolIdMap, null, 2), 'utf8');

  return { results, toolIdMap };
}

async function syncPhoneNumbers() {
  console.log('Syncing phone numbers...');

  const results: Array<{ action: string; number?: string; client?: string; assistantId?: string; error?: string }> = [];
  const SERVER_URL = (process.env.SERVER_URL || 'https://texintel.com').replace(/\/$/, '');

  try {
    const phoneNumbersResponse = await vapiClient.listPhoneNumbers();
    const phoneNumbers = phoneNumbersResponse.results || [];

    if (phoneNumbers.length === 0) {
      console.log('  No phone numbers found in Vapi - buy numbers in dashboard first\n');
      return results;
    }

    await databaseService.init();

    for (const phoneNumber of phoneNumbers) {
      try {
        const number = phoneNumber.number;
        const phoneNumberId = phoneNumber.id;
        const client = await databaseService.getClientByPhoneNumberId(phoneNumberId);

        if (!client) {
          console.log(`  ⚠ ${number}: No client mapping - add to client_phone_numbers table`);
          continue;
        }

        if (!client.vapi_assistant_id) {
          console.log(`  ⚠ ${number}: Client ${client.name} has no assistant - run sync-assistants first`);
          continue;
        }

        const config = {
          server: {
            url: `${SERVER_URL}/inbound`
          },
          assistantId: null as any, // Remove static assignment - forces assistant-request
        };

        await vapiClient.updatePhoneNumber(phoneNumberId, config);
        results.push({ action: 'updated', number, client: client.name, assistantId: client.vapi_assistant_id });

        // Save phone number mapping to database
        await databaseService.addClientPhoneNumber(client.id, phoneNumberId, number);

      } catch (error: any) {
        console.error(`  ✗ Error updating ${phoneNumber.number}: ${error.message}`);
        results.push({ action: 'error', number: phoneNumber.number, error: error.message });
      }
    }

    const updated = results.filter(r => r.action === 'updated').length;
    const errors = results.filter(r => r.action === 'error').length;

    if (updated > 0) {
      console.log(`  ✓ ${updated} phone number(s) synced${errors > 0 ? `, ${errors} errors` : ''}`);
    } else if (errors > 0) {
      console.log(`  ✗ ${errors} errors`);
    }

  } catch (error: any) {
    console.error(`  ✗ Failed to sync phone numbers: ${error.message}`);
    throw error;
  }

  return results;
}

async function syncStructuredOutputs() {
  console.log('Syncing structured outputs...');

  try {
    const existingOutputs = await vapiClient.listStructuredOutputs();
    const existing = existingOutputs.results.find(
      (o: any) => o.name === STRUCTURED_OUTPUT_SCHEMA.name
    );

    let outputId: string;

    if (existing && existing.id) {
      const updated = await vapiClient.updateStructuredOutput(existing.id, STRUCTURED_OUTPUT_SCHEMA);
      outputId = updated.id;
    } else {
      const created = await vapiClient.createStructuredOutput(STRUCTURED_OUTPUT_SCHEMA);
      outputId = created.id;
      console.log(`  ✓ Created: ${STRUCTURED_OUTPUT_SCHEMA.name}`);
    }

    // Save to config file
    const configPath = path.join(__dirname, '../src/config/structured-output-id.json');
    fs.writeFileSync(configPath, JSON.stringify({ id: outputId, name: STRUCTURED_OUTPUT_SCHEMA.name }, null, 2), 'utf8');
    console.log(`  ✓ Structured output synced`);

    return { action: existing ? 'updated' : 'created', id: outputId };
  } catch (error: any) {
    console.error(`  ✗ Error: ${error.message}`);
    throw error;
  }
}

async function syncAssistants(clientFilter?: string) {
  console.log('Syncing assistants...');

  try {
    await databaseService.init();

    const clients = clientFilter
      ? [await databaseService.getClientById(clientFilter)]
      : await databaseService.getAllClients();

    if (!clients || clients.length === 0 || (clients.length === 1 && !clients[0])) {
      console.error(`  ✗ No clients found${clientFilter ? ` with ID: ${clientFilter}` : ''}`);
      return;
    }

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const client of clients) {
      if (!client) continue;

      try {
        const config = buildAssistantConfig(client);

        if (client.vapi_assistant_id) {
          await vapiClient.updateAssistant(client.vapi_assistant_id, config);
          updated++;
        } else {
          const createdAssistant = await vapiClient.createAssistant(config);
          await databaseService.updateClientAssistantId(client.id, createdAssistant.id!);
          created++;
          console.log(`  ✓ Created assistant for: ${client.name}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error syncing ${client.name}: ${error.message}`);
        errors++;
      }
    }

    if (created > 0 || errors > 0) {
      console.log(`  ${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''}`);
    } else {
      console.log(`  ✓ ${updated} assistant(s) synced`);
    }

  } catch (error: any) {
    console.error(`  ✗ Failed to sync assistants: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   Vapi Configuration Sync Tool       ║');
  console.log('╚══════════════════════════════════════╝\n');

  if (!process.env.VAPI_API_KEY) {
    console.error('✗ VAPI_API_KEY not found - set it in .env');
    process.exit(1);
  }

  try {
    const args = process.argv.slice(2);
    const clientArg = args.find(arg => arg.startsWith('--client='));
    const clientFilter = clientArg ? clientArg.split('=')[1] : undefined;

    if (clientFilter) {
      console.log(`Syncing for client: ${clientFilter}\n`);
    }

    await syncTools();
    await syncStructuredOutputs();
    await syncAssistants(clientFilter);
    await syncPhoneNumbers();

    console.log('\n✓ Sync complete!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
