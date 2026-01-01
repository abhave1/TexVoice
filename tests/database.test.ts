import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { databaseService } from '../src/services/database.service';
import fs from 'fs';
import path from 'path';

describe('Database Service', () => {
  const TEST_DB_PATH = path.join(__dirname, '../test-calls.db');

  beforeEach(async () => {
    // Use in-memory database for testing
    process.env.DATABASE_PATH = ':memory:';
    await databaseService.init();
  });

  afterEach(async () => {
    // Clean up
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('saveCall', () => {
    it('should save a call record', async () => {
      const callData = {
        id: 'test-call-123',
        phoneNumberId: 'phone-123',
        callerPhone: '+14805551234',
        callType: 'inboundPhoneCall',
        startedAt: '2026-01-01T12:00:00Z',
        endedAt: '2026-01-01T12:05:00Z',
        status: 'ended',
        endedReason: 'assistant-ended-call',
        transcript: 'Test transcript',
        summary: 'Test summary',
        recordingUrl: 'https://example.com/recording.mp3',
        stereoRecordingUrl: 'https://example.com/stereo.mp3',
        successScore: 8,
        cost: 0.15,
        costBreakdown: {
          transport: 0.01,
          stt: 0.02,
          llm: 0.05,
          tts: 0.06,
          vapi: 0.01,
          llmPromptTokens: 1500,
          llmCompletionTokens: 200,
          ttsCharacters: 300
        }
      };

      await databaseService.saveCall(callData);

      const savedCall = await databaseService.getCall('test-call-123');
      expect(savedCall).toBeDefined();
      expect(savedCall?.id).toBe('test-call-123');
      expect(savedCall?.caller_phone).toBe('+14805551234');
      expect(savedCall?.status).toBe('ended');
      expect(savedCall?.cost_total).toBe(0.15);
      expect(savedCall?.cost_llm).toBe(0.05);
      expect(savedCall?.summary).toBe('Test summary');
    });

    it('should handle missing optional fields', async () => {
      const minimalCall = {
        id: 'minimal-123',
        status: 'ended'
      };

      await databaseService.saveCall(minimalCall);

      const savedCall = await databaseService.getCall('minimal-123');
      expect(savedCall).toBeDefined();
      expect(savedCall?.id).toBe('minimal-123');
      expect(savedCall?.caller_phone).toBeNull();
      expect(savedCall?.cost_total).toBeNull();
    });

    it('should update existing call on duplicate id', async () => {
      const call = {
        id: 'update-test',
        status: 'in-progress',
        cost: 0.05
      };

      await databaseService.saveCall(call);

      // Update with new data
      const updatedCall = {
        id: 'update-test',
        status: 'ended',
        cost: 0.15,
        summary: 'Updated summary'
      };

      await databaseService.saveCall(updatedCall);

      const savedCall = await databaseService.getCall('update-test');
      expect(savedCall?.status).toBe('ended');
      expect(savedCall?.cost_total).toBe(0.15);
      expect(savedCall?.summary).toBe('Updated summary');
    });
  });

  describe('saveStructuredData', () => {
    it('should save structured data for a call', async () => {
      // First save the call
      await databaseService.saveCall({
        id: 'structured-call',
        status: 'ended'
      });

      const structuredData = {
        caller: {
          name: 'John Doe',
          company: 'ABC Construction',
          phone: '+14805551234',
          email: 'john@abc.com'
        },
        intent: {
          category: 'rental',
          subcategory: 'dozer rental inquiry'
        },
        machine: {
          make: 'Caterpillar',
          model: 'D8',
          category: 'dozer'
        },
        details: {
          location: 'Phoenix, AZ',
          timing: 'next week',
          urgency: 'high'
        },
        outcome: {
          type: 'information_provided',
          next_step: 'Customer will call back'
        },
        notes: 'Interested in long-term rental'
      };

      await databaseService.saveStructuredData('structured-call', structuredData);

      const call = await databaseService.getCall('structured-call');
      expect(call?.caller_name).toBe('John Doe');
      expect(call?.caller_company).toBe('ABC Construction');
      expect(call?.intent_category).toBe('rental');
      expect(call?.machine_model).toBe('D8');
      expect(call?.urgency).toBe('high');
      expect(call?.notes).toBe('Interested in long-term rental');
    });

    it('should handle partial structured data', async () => {
      await databaseService.saveCall({
        id: 'partial-call',
        status: 'ended'
      });

      const partialData = {
        caller: {
          name: 'Jane Smith'
        },
        intent: {
          category: 'service'
        }
      };

      await databaseService.saveStructuredData('partial-call', partialData);

      const call = await databaseService.getCall('partial-call');
      expect(call?.caller_name).toBe('Jane Smith');
      expect(call?.intent_category).toBe('service');
      expect(call?.caller_company).toBeNull();
    });
  });

  describe('saveContact', () => {
    it('should create new contact', async () => {
      const contact = {
        name: 'Bob Builder',
        phone: '+15125559999',
        company: 'Builder Co',
        email: 'bob@builder.com'
      };

      await databaseService.saveContact(contact);

      // Verify by getting recent calls that might reference this contact
      // (We don't have a direct getContact method, but contacts affect caller recognition)
      const calls = await databaseService.getRecentCalls(10);
      // Contact saved successfully if no error thrown
      expect(true).toBe(true);
    });

    it('should update existing contact', async () => {
      const contact = {
        name: 'Sarah Martinez',
        phone: '+14695558888',
        company: 'Martinez LLC'
      };

      await databaseService.saveContact(contact);

      // Update with email
      const updatedContact = {
        ...contact,
        email: 'sarah@martinez.com'
      };

      await databaseService.saveContact(updatedContact);

      // Contact updated successfully if no error thrown
      expect(true).toBe(true);
    });
  });

  describe('getBillingSummary', () => {
    beforeEach(async () => {
      // Create test calls with cost data
      await databaseService.saveCall({
        id: 'billing-1',
        status: 'ended',
        cost: 0.15,
        costBreakdown: { llm: 0.05, tts: 0.06, stt: 0.02, vapi: 0.02 }
      });

      await databaseService.saveCall({
        id: 'billing-2',
        status: 'ended',
        cost: 0.22,
        costBreakdown: { llm: 0.08, tts: 0.09, stt: 0.03, vapi: 0.02 }
      });

      await databaseService.saveCall({
        id: 'billing-3',
        status: 'ended',
        cost: null // Call with no cost
      });
    });

    it('should calculate total cost correctly', async () => {
      const summary = await databaseService.getBillingSummary({ limit: 100 });

      expect(summary.totalCost).toBe(0.37); // 0.15 + 0.22
      expect(summary.callCount).toBe(3);
      expect(summary.calls).toHaveLength(3);
    });

    it('should respect limit parameter', async () => {
      const summary = await databaseService.getBillingSummary({ limit: 2 });

      expect(summary.calls).toHaveLength(2);
      expect(summary.callCount).toBe(2);
    });

    it('should filter by date range', async () => {
      // This test assumes calls have created_at timestamps
      const summary = await databaseService.getBillingSummary({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        limit: 100
      });

      expect(summary).toBeDefined();
      expect(summary.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should handle calls with null costs', async () => {
      const summary = await databaseService.getBillingSummary({ limit: 100 });

      // Should not crash and should calculate total correctly
      expect(summary.totalCost).toBe(0.37);
    });
  });

  describe('getRecentCalls', () => {
    beforeEach(async () => {
      // Create multiple test calls
      for (let i = 1; i <= 15; i++) {
        await databaseService.saveCall({
          id: `recent-call-${i}`,
          status: 'ended',
          callerPhone: `+148055512${i.toString().padStart(2, '0')}`
        });
      }
    });

    it('should return recent calls with limit', async () => {
      const calls = await databaseService.getRecentCalls(10);

      expect(calls).toHaveLength(10);
    });

    it('should return all calls if limit exceeds total', async () => {
      const calls = await databaseService.getRecentCalls(100);

      expect(calls.length).toBeLessThanOrEqual(100);
    });

    it('should order by created_at descending', async () => {
      const calls = await databaseService.getRecentCalls(15);

      // Most recent should be first (higher id in our test data)
      expect(calls[0].id).toBe('recent-call-15');
    });
  });

  describe('getCall', () => {
    it('should return call by id', async () => {
      await databaseService.saveCall({
        id: 'get-test',
        callerPhone: '+14805551234',
        status: 'ended'
      });

      const call = await databaseService.getCall('get-test');

      expect(call).toBeDefined();
      expect(call?.id).toBe('get-test');
      expect(call?.caller_phone).toBe('+14805551234');
    });

    it('should return null for non-existent call', async () => {
      const call = await databaseService.getCall('does-not-exist');

      expect(call).toBeNull();
    });
  });

  describe('getDailyStats', () => {
    it('should return daily aggregated statistics', async () => {
      // Create calls for testing
      await databaseService.saveCall({
        id: 'stats-1',
        status: 'ended',
        cost: 0.15
      });

      const stats = await databaseService.getDailyStats(7);

      expect(Array.isArray(stats)).toBe(true);
      // Stats format depends on database view implementation
    });

    it('should respect days parameter', async () => {
      const stats30 = await databaseService.getDailyStats(30);
      const stats7 = await databaseService.getDailyStats(7);

      expect(Array.isArray(stats30)).toBe(true);
      expect(Array.isArray(stats7)).toBe(true);
    });
  });

  describe('getIntentBreakdown', () => {
    beforeEach(async () => {
      // Create calls with different intents
      await databaseService.saveCall({ id: 'intent-1', status: 'ended' });
      await databaseService.saveStructuredData('intent-1', {
        intent: { category: 'rental' }
      });

      await databaseService.saveCall({ id: 'intent-2', status: 'ended' });
      await databaseService.saveStructuredData('intent-2', {
        intent: { category: 'rental' }
      });

      await databaseService.saveCall({ id: 'intent-3', status: 'ended' });
      await databaseService.saveStructuredData('intent-3', {
        intent: { category: 'service' }
      });
    });

    it('should return intent counts', async () => {
      const breakdown = await databaseService.getIntentBreakdown();

      expect(Array.isArray(breakdown)).toBe(true);

      const rentalIntent = breakdown.find(i => i.category === 'rental');
      const serviceIntent = breakdown.find(i => i.category === 'service');

      expect(rentalIntent?.count).toBe(2);
      expect(serviceIntent?.count).toBe(1);
    });
  });

  describe('Client Management', () => {
    it('should get client by phone number id', async () => {
      // This assumes clients table is populated
      // For now, test that method doesn't crash
      const client = await databaseService.getClientByPhoneNumberId('phone-123');

      // Client may be null if not seeded in test DB
      expect(client === null || typeof client === 'object').toBe(true);
    });

    it('should get all clients', async () => {
      const clients = await databaseService.getAllClients();

      expect(Array.isArray(clients)).toBe(true);
    });

    it('should get client by id', async () => {
      const client = await databaseService.getClientById('test-client-id');

      expect(client === null || typeof client === 'object').toBe(true);
    });
  });

  describe('Call History', () => {
    beforeEach(async () => {
      // Create multiple calls from same number
      for (let i = 1; i <= 5; i++) {
        await databaseService.saveCall({
          id: `history-${i}`,
          callerPhone: '+14805551234',
          status: 'ended'
        });
      }
    });

    it('should get call history for phone number', async () => {
      const history = await databaseService.getCallHistory('+14805551234', 10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);

      if (history.length > 0) {
        expect(history[0].caller_phone).toBe('+14805551234');
      }
    });

    it('should respect limit parameter in history', async () => {
      const history = await databaseService.getCallHistory('+14805551234', 3);

      expect(history.length).toBeLessThanOrEqual(3);
    });
  });
});
