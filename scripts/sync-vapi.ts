#!/usr/bin/env tsx
// scripts/sync-vapi.ts
// Sync local Vapi configuration to the cloud

// IMPORTANT: Load env vars FIRST before any other imports
import 'dotenv/config';
import { vapiClient } from '../src/services/vapi-client.service';
import { VAPI_TOOLS, PHONE_NUMBER_CONFIG } from '../src/config/vapi-config';

async function syncTools() {
  console.log('🔄 Syncing tools to Vapi...\n');

  const results = [];

  for (const tool of VAPI_TOOLS) {
    try {
      console.log(`📦 Processing tool: ${tool.function.name}`);

      // Try to find existing tool by name
      const existingTools = await vapiClient.listTools();
      const existing = existingTools.results.find(
        t => t.function.name === tool.function.name
      );

      if (existing && existing.id) {
        // Update existing tool
        console.log(`   ↻ Updating existing tool (ID: ${existing.id})`);
        const updated = await vapiClient.updateTool(existing.id, tool);
        results.push({ action: 'updated', tool: updated });
        console.log(`   ✅ Updated successfully\n`);
      } else {
        // Create new tool
        console.log(`   + Creating new tool`);
        const created = await vapiClient.createTool(tool);
        results.push({ action: 'created', tool: created });
        console.log(`   ✅ Created successfully (ID: ${created.id})\n`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}\n`);
      results.push({ action: 'error', tool: tool.function.name, error: error.message });
    }
  }

  // Summary
  console.log('━'.repeat(50));
  console.log('📊 Sync Summary:');
  console.log(`   Total tools: ${VAPI_TOOLS.length}`);
  console.log(`   Created: ${results.filter(r => r.action === 'created').length}`);
  console.log(`   Updated: ${results.filter(r => r.action === 'updated').length}`);
  console.log(`   Errors: ${results.filter(r => r.action === 'error').length}`);
  console.log('━'.repeat(50));

  return results;
}

async function syncPhoneNumbers() {
  console.log('📱 Syncing phone numbers to Vapi...\n');

  const results = [];

  try {
    // Fetch all phone numbers
    const phoneNumbersResponse = await vapiClient.listPhoneNumbers();
    const phoneNumbers = phoneNumbersResponse.results || [];

    if (phoneNumbers.length === 0) {
      console.log('   ⚠️  No phone numbers found in Vapi');
      console.log('   💡 Buy phone numbers in the Vapi dashboard first\n');
      return results;
    }

    console.log(`   Found ${phoneNumbers.length} phone number(s)\n`);

    for (const phoneNumber of phoneNumbers) {
      try {
        const number = phoneNumber.number;
        console.log(`📞 Processing: ${number}`);

        // Get config for this specific number, or use default
        let config = (PHONE_NUMBER_CONFIG as any)[number] || PHONE_NUMBER_CONFIG.default;

        // CRITICAL: If assistantId is null, we need to explicitly unset it
        // Vapi API ignores null values, so we remove it from the payload
        if (config.assistantId === null) {
          const { assistantId, ...configWithoutAssistant } = config;
          // Unfortunately, Vapi doesn't support removing assistantId via API
          // You MUST manually remove it in the dashboard
          console.log(`   ⚠️  WARNING: assistantId is set to null in config`);
          console.log(`   ⚠️  Vapi API cannot remove assistantId - you must do this manually in dashboard`);
          console.log(`   ⚠️  Go to: https://dashboard.vapi.ai/phone-numbers`);
          console.log(`   ⚠️  Click your number and remove the Assistant selection\n`);
        }

        // Update phone number configuration
        console.log(`   ↻ Updating configuration...`);
        const updated = await vapiClient.updatePhoneNumber(phoneNumber.id, config);

        results.push({ action: 'updated', number, config });
        console.log(`   ✅ Updated successfully`);
        console.log(`      Server URL: ${config.serverUrl}`);
        console.log(`      Assistant ID: ${config.assistantId || 'null (using server URL)'}\n`);

      } catch (error: any) {
        console.error(`   ❌ Error updating ${phoneNumber.number}: ${error.message}\n`);
        results.push({ action: 'error', number: phoneNumber.number, error: error.message });
      }
    }

    // Summary
    console.log('━'.repeat(50));
    console.log('📊 Phone Number Sync Summary:');
    console.log(`   Total numbers: ${phoneNumbers.length}`);
    console.log(`   Updated: ${results.filter(r => r.action === 'updated').length}`);
    console.log(`   Errors: ${results.filter(r => r.action === 'error').length}`);
    console.log('━'.repeat(50));

  } catch (error: any) {
    console.error(`❌ Failed to fetch phone numbers: ${error.message}`);
    throw error;
  }

  return results;
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
    console.error('❌ Error: VAPI_API_KEY not found in environment variables');
    console.error('   Please set it in your .env file');
    process.exit(1);
  }

  try {
    // Sync tools
    await syncTools();
    console.log('');

    // Sync phone numbers
    await syncPhoneNumbers();

    console.log('\n✅ All Vapi configuration synced successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
