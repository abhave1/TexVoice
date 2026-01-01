// src/services/database.service.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Database service for SQLite
 * Handles initialization, queries, and migrations
 */
class DatabaseService {
  private db: Database | null = null;
  private readonly dbPath: string;

  constructor() {
    // Store database in project root
    this.dbPath = join(process.cwd(), 'calls.db');
  }

  /**
   * Initialize database connection and schema
   */
  async init(): Promise<void> {
    try {
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Run schema
      const schemaPath = join(__dirname, '../db/schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');

      await this.db.exec(schema);

      // Enable foreign keys
      await this.db.run('PRAGMA foreign_keys = ON');
    } catch (error: any) {
      console.error('[Database] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Save call record from end-of-call-report
   */
  async saveCall(callData: {
    id: string;
    phoneNumberId?: string;
    callerPhone?: string;
    callType?: string;
    startedAt?: string;
    endedAt?: string;
    status: string;
    endedReason?: string;
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    successScore?: number;
    cost?: number;
    costBreakdown?: {
      transport?: number;
      stt?: number;
      llm?: number;
      tts?: number;
      vapi?: number;
      llmPromptTokens?: number;
      llmCompletionTokens?: number;
      ttsCharacters?: number;
    };
  }): Promise<void> {
    const db = this.getDb();

    // Calculate duration
    let durationSeconds: number | null = null;
    if (callData.startedAt && callData.endedAt) {
      const start = new Date(callData.startedAt).getTime();
      const end = new Date(callData.endedAt).getTime();
      durationSeconds = Math.floor((end - start) / 1000);
    }

    await db.run(`
      INSERT OR REPLACE INTO calls (
        id, phone_number_id, caller_phone, call_type,
        started_at, ended_at, duration_seconds,
        status, ended_reason,
        transcript, summary, recording_url, stereo_recording_url,
        success_score,
        cost_total, cost_transport, cost_stt, cost_llm, cost_tts, cost_vapi,
        llm_prompt_tokens, llm_completion_tokens, tts_characters,
        updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        CURRENT_TIMESTAMP
      )
    `, [
      callData.id,
      callData.phoneNumberId || null,
      callData.callerPhone || null,
      callData.callType || null,
      callData.startedAt || null,
      callData.endedAt || null,
      durationSeconds,
      callData.status,
      callData.endedReason || null,
      callData.transcript || null,
      callData.summary || null,
      callData.recordingUrl || null,
      callData.stereoRecordingUrl || null,
      callData.successScore || null,
      callData.cost || null,
      callData.costBreakdown?.transport || null,
      callData.costBreakdown?.stt || null,
      callData.costBreakdown?.llm || null,
      callData.costBreakdown?.tts || null,
      callData.costBreakdown?.vapi || null,
      callData.costBreakdown?.llmPromptTokens || null,
      callData.costBreakdown?.llmCompletionTokens || null,
      callData.costBreakdown?.ttsCharacters || null
    ]);

  }

  /**
   * Save structured data for a call
   */
  async saveStructuredData(callId: string, data: any): Promise<void> {
    const db = this.getDb();

    await db.run(`
      INSERT OR REPLACE INTO call_structured_data (
        call_id,
        caller_name, caller_company, caller_phone, caller_email,
        intent_category, intent_subcategory,
        machine_make, machine_model, machine_year, machine_serial, machine_category,
        location, timing, urgency,
        outcome_type, outcome_transferred_to, outcome_next_step, outcome_scheduled_callback_time,
        notes,
        raw_json
      ) VALUES (
        ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?
      )
    `, [
      callId,
      data.caller?.name || null,
      data.caller?.company || null,
      data.caller?.phone || null,
      data.caller?.email || null,
      data.intent?.category || null,
      data.intent?.subcategory || null,
      data.machine?.make || null,
      data.machine?.model || null,
      data.machine?.year || null,
      data.machine?.serial || null,
      data.machine?.category || null,
      data.details?.location || null,
      data.details?.timing || null,
      data.details?.urgency || null,
      data.outcome?.type || null,
      data.outcome?.transferred_to || null,
      data.outcome?.next_step || null,
      data.outcome?.scheduled_callback_time || null,
      data.notes || null,
      JSON.stringify(data)
    ]);

  }

  /**
   * Get call by ID
   */
  async getCall(callId: string): Promise<any> {
    const db = this.getDb();
    return await db.get('SELECT * FROM call_details WHERE id = ?', [callId]);
  }

  /**
   * Get recent calls
   */
  async getRecentCalls(limit: number = 10): Promise<any[]> {
    const db = this.getDb();
    return await db.all(
      'SELECT * FROM call_details ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(days: number = 7): Promise<any[]> {
    const db = this.getDb();
    return await db.all(`
      SELECT * FROM daily_call_stats
      WHERE date >= date('now', '-${days} days')
      ORDER BY date DESC
    `);
  }

  /**
   * Get intent breakdown
   */
  async getIntentBreakdown(): Promise<any[]> {
    const db = this.getDb();
    return await db.all('SELECT * FROM intent_breakdown');
  }

  /**
   * Update or create contact from call
   */
  async updateContact(phoneNumber: string, data: {
    name?: string;
    company?: string;
    email?: string;
    lastMachine?: string;
  }): Promise<void> {
    const db = this.getDb();

    // Check if contact exists
    const existing = await db.get(
      'SELECT * FROM contacts WHERE phone_number = ?',
      [phoneNumber]
    );

    if (existing) {
      // Update existing
      await db.run(`
        UPDATE contacts
        SET
          name = COALESCE(?, name),
          company = COALESCE(?, company),
          email = COALESCE(?, email),
          last_machine = COALESCE(?, last_machine),
          total_calls = total_calls + 1,
          last_call_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE phone_number = ?
      `, [
        data.name || null,
        data.company || null,
        data.email || null,
        data.lastMachine || null,
        phoneNumber
      ]);
    } else {
      // Create new
      await db.run(`
        INSERT INTO contacts (
          phone_number, name, company, email, last_machine,
          total_calls, first_call_at, last_call_at
        ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        phoneNumber,
        data.name || null,
        data.company || null,
        data.email || null,
        data.lastMachine || null
      ]);
    }

  }

  // ==================== CONTACTS QUERIES ====================

  /**
   * Get contact by phone number
   */
  async getContact(phoneNumber: string): Promise<any | null> {
    const db = this.getDb();
    const result = await db.get(
      'SELECT * FROM contacts WHERE phone_number = ?',
      [phoneNumber]
    );
    return result;
  }

  /**
   * Get all contacts
   */
  async getAllContacts(): Promise<any[]> {
    const db = this.getDb();
    return await db.all('SELECT * FROM contacts ORDER BY name');
  }

  /**
   * Search contacts by name or company
   */
  async searchContacts(query: string): Promise<any[]> {
    const db = this.getDb();
    return await db.all(`
      SELECT * FROM contacts
      WHERE name LIKE ? OR company LIKE ?
      ORDER BY name
    `, [`%${query}%`, `%${query}%`]);
  }

  // ==================== INVENTORY QUERIES ====================

  /**
   * Get all inventory items
   */
  async getAllInventory(): Promise<any[]> {
    const db = this.getDb();
    return await db.all('SELECT * FROM inventory ORDER BY category, model');
  }

  /**
   * Get available inventory (available > 0)
   */
  async getAvailableInventory(): Promise<any[]> {
    const db = this.getDb();
    return await db.all(
      'SELECT * FROM inventory WHERE available > 0 ORDER BY category, model'
    );
  }

  /**
   * Search inventory by model, category, or specs
   */
  async searchInventory(query: string): Promise<any[]> {
    const db = this.getDb();
    const searchPattern = `%${query}%`;
    return await db.all(`
      SELECT * FROM inventory
      WHERE model LIKE ? OR category LIKE ? OR specs LIKE ?
      ORDER BY
        CASE WHEN available > 0 THEN 0 ELSE 1 END,
        category, model
    `, [searchPattern, searchPattern, searchPattern]);
  }

  /**
   * Get inventory by category
   */
  async getInventoryByCategory(category: string): Promise<any[]> {
    const db = this.getDb();
    return await db.all(
      'SELECT * FROM inventory WHERE category LIKE ? ORDER BY model',
      [`%${category}%`]
    );
  }

  /**
   * Update inventory availability
   */
  async updateInventoryAvailability(model: string, available: number): Promise<void> {
    const db = this.getDb();
    await db.run(`
      UPDATE inventory
      SET available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE model = ?
    `, [available, model]);
  }

  // ==================== CLIENT QUERIES ====================

  /**
   * Get client by ID
   */
  async getClientById(clientId: string): Promise<any | null> {
    const db = this.getDb();
    return await db.get('SELECT * FROM clients WHERE id = ?', [clientId]);
  }

  /**
   * Get all clients
   */
  async getAllClients(): Promise<any[]> {
    const db = this.getDb();
    return await db.all('SELECT * FROM clients ORDER BY name');
  }

  /**
   * Get client by VAPI phone number ID
   * Maps phone number to client with fallback to default
   */
  async getClientByPhoneNumberId(vapiPhoneNumberId: string): Promise<any | null> {
    const db = this.getDb();

    // Try to find client by phone number mapping
    const result = await db.get(`
      SELECT c.* FROM clients c
      INNER JOIN client_phone_numbers cpn ON c.id = cpn.client_id
      WHERE cpn.vapi_phone_number_id = ?
    `, [vapiPhoneNumberId]);

    // Fallback to default client if not found
    if (!result) {
      return await this.getClientById('tex-intel-primary');
    }

    return result;
  }

  /**
   * Update client's VAPI assistant ID
   */
  async updateClientAssistantId(clientId: string, assistantId: string): Promise<void> {
    const db = this.getDb();
    await db.run(`
      UPDATE clients
      SET vapi_assistant_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [assistantId, clientId]);
  }

  /**
   * Add or update phone number mapping to client
   */
  async addClientPhoneNumber(
    clientId: string,
    vapiPhoneNumberId: string,
    phoneNumber: string
  ): Promise<void> {
    const db = this.getDb();
    await db.run(`
      INSERT OR REPLACE INTO client_phone_numbers
      (client_id, vapi_phone_number_id, phone_number)
      VALUES (?, ?, ?)
    `, [clientId, vapiPhoneNumberId, phoneNumber]);
  }

  /**
   * Create or update client configuration
   */
  async upsertClient(clientData: {
    id: string;
    name: string;
    company?: string;
    salesPhone?: string;
    servicePhone?: string;
    partsPhone?: string;
    customPrompt?: string;
    firstMessageTemplate?: string;
    enableInventory: boolean;
    enableTransfers: boolean;
  }): Promise<void> {
    const db = this.getDb();

    // Check if client exists
    const existing = await db.get('SELECT id FROM clients WHERE id = ?', [clientData.id]);

    if (existing) {
      // Update existing client
      await db.run(`
        UPDATE clients
        SET
          name = ?,
          company = ?,
          sales_phone = ?,
          service_phone = ?,
          parts_phone = ?,
          custom_prompt = ?,
          first_message_template = ?,
          enable_inventory = ?,
          enable_transfers = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        clientData.name,
        clientData.company || null,
        clientData.salesPhone || null,
        clientData.servicePhone || null,
        clientData.partsPhone || null,
        clientData.customPrompt || null,
        clientData.firstMessageTemplate || null,
        clientData.enableInventory ? 1 : 0,
        clientData.enableTransfers ? 1 : 0,
        clientData.id
      ]);
    } else {
      // Create new client
      await db.run(`
        INSERT INTO clients (
          id, name, company,
          sales_phone, service_phone, parts_phone,
          custom_prompt, first_message_template,
          enable_inventory, enable_transfers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        clientData.id,
        clientData.name,
        clientData.company || null,
        clientData.salesPhone || null,
        clientData.servicePhone || null,
        clientData.partsPhone || null,
        clientData.customPrompt || null,
        clientData.firstMessageTemplate || null,
        clientData.enableInventory ? 1 : 0,
        clientData.enableTransfers ? 1 : 0
      ]);
    }
  }

  /**
   * Get client configuration with phone number mapping
   */
  async getClientConfig(clientId: string): Promise<any> {
    const db = this.getDb();

    // Get client details
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [clientId]);

    if (!client) {
      return null;
    }

    // Get phone number mapping
    const phoneMapping = await db.get(`
      SELECT vapi_phone_number_id, phone_number
      FROM client_phone_numbers
      WHERE client_id = ?
    `, [clientId]);

    return {
      ...client,
      vapi_phone_number_id: phoneMapping?.vapi_phone_number_id || null,
      phone_number: phoneMapping?.phone_number || null
    };
  }

  /**
   * Save callback request
   */
  async saveCallbackRequest(data: {
    clientId: string;
    customerName: string;
    customerPhone: string;
    preferredTime: string;
    reason: string;
    department: string;
  }): Promise<void> {
    const db = this.getDb();

    // Create callbacks table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS callback_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        preferred_time TEXT NOT NULL,
        reason TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    // Insert callback request
    await db.run(`
      INSERT INTO callback_requests (
        client_id, customer_name, customer_phone, preferred_time, reason, department
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.clientId,
      data.customerName,
      data.customerPhone,
      data.preferredTime,
      data.reason,
      data.department
    ]);

  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
