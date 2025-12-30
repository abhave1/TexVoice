#!/usr/bin/env tsx
// scripts/sync-vapi.ts
// Sync local Vapi configuration to the cloud

// IMPORTANT: Load env vars FIRST before any other imports
import 'dotenv/config';
import { vapiClient } from '../src/services/vapi-client.service';
import { VAPI_TOOLS } from '../src/config/vapi-config';

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
    await syncTools();
    console.log('\n✅ Sync completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
