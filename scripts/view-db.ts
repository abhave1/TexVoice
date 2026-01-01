#!/usr/bin/env tsx
// scripts/view-db.ts

/**
 * Database Viewer Utility
 * Quick view of database contents for debugging
 *
 * Usage:
 *   npm run db:view
 */

import { databaseService } from '../src/services/database.service';

async function main() {
  try {
    await databaseService.init();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                   DATABASE VIEWER');
    console.log('═══════════════════════════════════════════════════════════\n');

    // ==================== CLIENTS ====================
    console.log('CLIENTS\n');
    const clients = await databaseService.getAllClients();

    if (clients.length === 0) {
      console.log('  No clients found. Run: npm run onboard\n');
    } else {
      for (const client of clients) {
        console.log(`  • ${client.name} (${client.id})`);
        console.log(`    Assistant ID: ${client.vapi_assistant_id || 'NOT SET'}`);
        console.log(`    Sales: ${client.sales_phone || 'N/A'}`);
        console.log(`    Service: ${client.service_phone || 'N/A'}`);
        console.log(`    Parts: ${client.parts_phone || 'N/A'}`);
        console.log(`    Tools: inventory=${client.enable_inventory ? 'ON' : 'OFF'}, transfers=${client.enable_transfers ? 'ON' : 'OFF'}`);
        console.log();
      }
    }

    // ==================== PHONE NUMBERS ====================
    console.log('PHONE NUMBER MAPPINGS\n');
    const db = databaseService.getDb();
    const phoneNumbers = await db.all('SELECT * FROM client_phone_numbers');

    if (phoneNumbers.length === 0) {
      console.log('  No phone numbers mapped\n');
    } else {
      for (const phone of phoneNumbers) {
        console.log(`  • ${phone.phone_number} → ${phone.client_id}`);
        console.log(`    Vapi ID: ${phone.vapi_phone_number_id}`);
        console.log();
      }
    }

    // ==================== CONTACTS ====================
    console.log('👥 CONTACTS (Caller History)\n');
    const contacts = await databaseService.getAllContacts();

    if (contacts.length === 0) {
      console.log('  No contacts yet\n');
    } else {
      const sortedContacts = contacts
        .sort((a, b) => (b.total_calls || 0) - (a.total_calls || 0))
        .slice(0, 10);

      for (const contact of sortedContacts) {
        console.log(`  • ${contact.name || 'Unknown'} (${contact.phone_number})`);
        if (contact.company) console.log(`    Company: ${contact.company}`);
        console.log(`    Status: ${contact.status || 'Regular'}`);
        console.log(`    Total calls: ${contact.total_calls || 0}`);
        if (contact.last_machine) console.log(`    Last machine: ${contact.last_machine}`);
        console.log();
      }

      if (contacts.length > 10) {
        console.log(`  ... and ${contacts.length - 10} more\n`);
      }
    }

    // ==================== INVENTORY ====================
    console.log('🚜 INVENTORY (Available Equipment)\n');
    const inventory = await databaseService.getAvailableInventory();

    if (inventory.length === 0) {
      console.log('  No equipment available\n');
    } else {
      // Group by category
      const byCategory: Record<string, any[]> = {};
      for (const item of inventory) {
        if (!byCategory[item.category]) {
          byCategory[item.category] = [];
        }
        byCategory[item.category].push(item);
      }

      for (const [category, items] of Object.entries(byCategory)) {
        console.log(`  ${category}:`);
        for (const item of items) {
          console.log(`    • ${item.model} - ${item.available} available @ $${item.price_per_day}/day`);
          if (item.condition) console.log(`      Condition: ${item.condition}, Year: ${item.year || 'N/A'}`);
        }
        console.log();
      }
    }

    // ==================== RECENT CALLS ====================
    console.log('RECENT CALLS (Last 10)\n');
    const calls = await databaseService.getRecentCalls(10);

    if (calls.length === 0) {
      console.log('  No calls yet\n');
    } else {
      for (const call of calls) {
        console.log(`  • Call ${call.id.substring(0, 8)}... (${new Date(call.created_at).toLocaleString()})`);
        console.log(`    Caller: ${call.caller_phone || 'Unknown'}`);
        if (call.caller_name) console.log(`    Name: ${call.caller_name}`);
        if (call.intent_category) console.log(`    Intent: ${call.intent_category}`);
        if (call.machine_make) console.log(`    Machine: ${call.machine_make} ${call.machine_model || ''}`);
        console.log(`    Duration: ${call.duration_seconds || 0}s`);
        console.log(`    Success: ${call.success_score || 'N/A'}/10`);
        if (call.summary) console.log(`    Summary: ${call.summary.substring(0, 100)}...`);
        console.log();
      }
    }

    // ==================== ANALYTICS ====================
    console.log('ANALYTICS\n');

    // Intent breakdown
    const intentBreakdown = await databaseService.getIntentBreakdown();
    if (intentBreakdown.length > 0) {
      console.log('  Intent Distribution:');
      for (const row of intentBreakdown) {
        console.log(`    • ${row.intent_category}: ${row.count} calls (avg success: ${row.avg_success_score?.toFixed(1) || 'N/A'})`);
      }
      console.log();
    }

    // Daily stats
    const dailyStats = await databaseService.getDailyStats(7);
    if (dailyStats.length > 0) {
      console.log('  Last 7 Days:');
      for (const day of dailyStats) {
        console.log(`    • ${day.date}: ${day.total_calls} calls, avg ${Math.floor(day.avg_duration || 0)}s, $${(day.total_cost || 0).toFixed(2)}`);
      }
      console.log();
    }

    // Total stats
    const totalStats = await db.get(`
      SELECT
        COUNT(*) as total_calls,
        AVG(duration_seconds) as avg_duration,
        SUM(cost_total) as total_cost,
        AVG(success_score) as avg_success
      FROM calls
    `);

    if (totalStats.total_calls > 0) {
      console.log('  All Time:');
      console.log(`    • Total calls: ${totalStats.total_calls}`);
      console.log(`    • Avg duration: ${Math.floor(totalStats.avg_duration || 0)}s`);
      console.log(`    • Total cost: $${(totalStats.total_cost || 0).toFixed(2)}`);
      console.log(`    • Avg success: ${(totalStats.avg_success || 0).toFixed(1)}/10`);
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

main();
