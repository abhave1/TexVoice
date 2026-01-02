// src/services/customer.service.ts
import { SYSTEM_PROMPT } from '../prompts/system-prompt';

export class CustomerService {
  /**
   * Get system prompt template with custom variables from database
   * Variables passed via assistantOverrides.variableValues:
   * - {{customer_name}} - Customer name from our database
   * - {{customer_company}} - Company name from our database
   * - {{customer_status}} - VIP, Regular, New, etc.
   * - {{last_machine}} - Last equipment they rented/inquired about
   * - {{company_name}} - Client's company name
   */
  getSystemPrompt(_clientName: string = 'Tex Intel'): string {
    // Return the shared system prompt from single source of truth
    return SYSTEM_PROMPT;
  }
}

// Export singleton instance
export const customerService = new CustomerService();
