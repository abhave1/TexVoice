// src/services/context-builder.service.ts
import { databaseService } from './database.service';
import { SYSTEM_PROMPT } from '../prompts/system-prompt';

/**
 * Context Builder Service
 * Builds dynamic per-call context for assistant overrides
 * This is the "transient" part of the hybrid approach
 */

interface CallContext {
  callerPhone: string;
  clientId: string;
  phoneNumberId: string;
}

interface CallerHistory {
  name?: string;
  company?: string;
  status?: string;
  last_machine?: string;
  total_calls?: number;
  last_call_at?: string;
}

interface BusinessHoursInfo {
  isOpen: boolean;
  currentDay: string;
  currentTime: string;
  nextOpenTime?: string;
}

/**
 * Build dynamic system message context for a call
 * This gets injected as a transient override to the permanent assistant
 *
 * INJECTING FULL PROMPT HERE to ensure it's always used
 */
export async function buildDynamicContext(context: CallContext): Promise<{
  contextMessage: string;
  isAfterHours: boolean;
}> {
  const { callerPhone, clientId } = context;

  // 1. Get client info for company name
  const client = await databaseService.getClientById(clientId);
  const companyName = client?.name || 'Tex Intel';

  // 2. Look up caller history
  const callerHistory = await getCallerHistory(callerPhone);

  // 3. Check business hours
  const businessHours = getBusinessHoursInfo();

  // 4. Start with the full system prompt and replace {{company_name}} with actual name
  let contextMessage = SYSTEM_PROMPT.replace(/\{\{company_name\}\}/g, companyName);
  contextMessage += '\n\n---\n\nCURRENT CALL CONTEXT:\n\n';

  // === CALLER INFORMATION ===
  if (callerHistory.name) {
    contextMessage += `CALLER:\n`;
    contextMessage += `- Name: ${callerHistory.name}\n`;
    if (callerHistory.company) {
      contextMessage += `- Company: ${callerHistory.company}\n`;
    }
    if (callerHistory.status) {
      contextMessage += `- Status: ${callerHistory.status}\n`;
    }
    if (callerHistory.last_machine) {
      contextMessage += `- Previously asked about: ${callerHistory.last_machine}\n`;
    }
    contextMessage += `- Phone: ${callerPhone}\n\n`;
  } else {
    contextMessage += `CALLER:\n`;
    contextMessage += `- New caller (no history)\n`;
    contextMessage += `- Phone: ${callerPhone}\n\n`;
  }

  // === BUSINESS HOURS STATUS ===
  contextMessage += `BUSINESS STATUS:\n`;
  contextMessage += `- Current time: ${businessHours.currentDay}, ${businessHours.currentTime}\n`;
  contextMessage += `- Office status: ${businessHours.isOpen ? 'OPEN' : 'CLOSED'}\n`;
  if (!businessHours.isOpen && businessHours.nextOpenTime) {
    contextMessage += `- Next open: ${businessHours.nextOpenTime}\n`;
  }
  contextMessage += `\n`;

  return {
    contextMessage,
    isAfterHours: !businessHours.isOpen
  };
}

/**
 * Get caller history from database
 */
async function getCallerHistory(phoneNumber: string): Promise<CallerHistory> {
  try {
    const contact = await databaseService.getContact(phoneNumber);
    if (contact) {
      return {
        name: contact.name,
        company: contact.company,
        status: contact.status,
        last_machine: contact.last_machine,
        total_calls: contact.total_calls,
        last_call_at: contact.last_call_at
      };
    }
  } catch (error) {
    console.error('[ContextBuilder] Error fetching caller history:', error);
  }

  return {};
}


/**
 * Get business hours information
 * TODO: Make this configurable per client in database
 */
function getBusinessHoursInfo(): BusinessHoursInfo {
  // Get current time in Arizona (MST/UTC-7, no DST)
  // Railway servers run in UTC, so we need to convert
  const now = new Date();
  const arizonaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Phoenix' }));

  const day = arizonaTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = arizonaTime.getHours();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = dayNames[day];
  const currentTime = arizonaTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Phoenix'
  });

  // Business hours: Monday-Friday 8am-8pm, Saturday 9am-3pm (TESTING: extended to 8pm)
  let isOpen = false;
  let nextOpenTime: string | undefined;

  if (day >= 1 && day <= 5) {
    // Monday-Friday
    isOpen = hour >= 8 && hour < 20;  // TESTING: changed from 18 to 20 (8pm)
    if (!isOpen && hour < 8) {
      nextOpenTime = `Today at 8:00 AM`;
    } else if (!isOpen && hour >= 20) {
      nextOpenTime = day === 5 ? 'Saturday at 9:00 AM' : 'Tomorrow at 8:00 AM';
    }
  } else if (day === 6) {
    // Saturday
    isOpen = hour >= 9 && hour < 15;
    if (!isOpen && hour < 9) {
      nextOpenTime = `Today at 9:00 AM`;
    } else if (!isOpen && hour >= 15) {
      nextOpenTime = 'Monday at 8:00 AM';
    }
  } else {
    // Sunday
    nextOpenTime = 'Monday at 8:00 AM';
  }

  return {
    isOpen,
    currentDay,
    currentTime,
    nextOpenTime
  };
}

/**
 * Build first message override based on caller and context
 */
export function buildFirstMessage(
  clientName: string,
  callerHistory: CallerHistory | null,
  isAfterHours: boolean
): string {
  if (isAfterHours) {
    if (callerHistory?.name) {
      return `Hi ${callerHistory.name}, thanks for calling ${clientName}. We're currently closed, but I can help you schedule a callback.`;
    }
    return `Thanks for calling ${clientName}. We're currently closed, but I can help you schedule a callback.`;
  }

  if (callerHistory?.name) {
    return `Hi ${callerHistory.name}, thanks for calling ${clientName} again. This is Tex, how can I help you today?`;
  }

  return `Thanks for calling ${clientName}. This is Tex, how can I help you today?`;
}
