#!/usr/bin/env tsx
// scripts/get-calls.ts
// Fetch and display recent call logs from Vapi

// IMPORTANT: Load env vars FIRST before any other imports
import 'dotenv/config';
import { vapiClient } from '../src/services/vapi-client.service';

async function getCalls() {
  const limit = parseInt(process.argv[2] || '10');

  console.log(`\n📞 Fetching last ${limit} calls...\n`);

  try {
    const response = await vapiClient.listCalls({ limit });

    if (response.results.length === 0) {
      console.log('   No calls found.');
      return;
    }

    console.log(`Found ${response.results.length} calls:\n`);

    for (const call of response.results) {
      const duration = call.endedAt && call.startedAt
        ? ((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000).toFixed(0)
        : 'N/A';

      console.log('━'.repeat(60));
      console.log(`📞 Call ID: ${call.id}`);
      console.log(`   Type: ${call.type}`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Date: ${new Date(call.createdAt).toLocaleString()}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Cost: $${call.cost?.toFixed(4) || '0.0000'}`);

      if (call.phoneNumber) {
        console.log(`   Phone: ${call.phoneNumber}`);
      }

      if (call.transcript) {
        const preview = call.transcript.substring(0, 100);
        console.log(`   Transcript: ${preview}${call.transcript.length > 100 ? '...' : ''}`);
      }
    }

    console.log('━'.repeat(60));
    console.log(`\nTotal calls: ${response.results.length}`);
    console.log(`Total cost: $${response.results.reduce((sum, c) => sum + (c.cost || 0), 0).toFixed(4)}`);

  } catch (error: any) {
    console.error('❌ Error fetching calls:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  if (!process.env.VAPI_API_KEY) {
    console.error('❌ Error: VAPI_API_KEY not found in environment variables');
    process.exit(1);
  }

  await getCalls();
}

main();
