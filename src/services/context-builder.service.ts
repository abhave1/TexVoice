// src/services/context-builder.service.ts
import { databaseService } from './database.service';

/**
 * Context Builder Service
 * Builds dynamic per-call variable values for assistant overrides
 * This is the "transient" part of the hybrid approach
 *
 * VARIABLES INJECTED INTO ASSISTANT PROMPT:
 * 1. {{caller_context}} - Caller information (name, company, history)
 * 2. {{business_hours_context}} - Current time, office status, next open time
 * 3. {{additional_context}} - Any extra client-specific context
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
  currentDate: string;
  currentTime: string;
  nextOpenTime?: string;
  upcomingBusinessDays: {
    tomorrow?: string;
    nextBusinessDay: string;
    nextMonday: string;
    nextTuesday: string;
  };
}

/**
 * Build dynamic variable values for a call
 * Returns structured data to be injected into assistant prompt template
 */
export async function buildDynamicContext(context: CallContext): Promise<{
  variables: {
    caller_context: string;
    business_hours_context: string;
    additional_context: string;
  };
  isAfterHours: boolean;
}> {
  const { callerPhone, clientId } = context;

  // 1. Get client info
  const client = await databaseService.getClientById(clientId);

  // 2. Look up caller history
  const callerHistory = await getCallerHistory(callerPhone);

  // 3. Check business hours
  const businessHours = getBusinessHoursInfo();

  // 4. Build caller context variable
  let callerContext = '';
  if (callerHistory.name) {
    callerContext += `Name: ${callerHistory.name}\n`;
    if (callerHistory.company) {
      callerContext += `Company: ${callerHistory.company}\n`;
    }
    if (callerHistory.status) {
      callerContext += `Status: ${callerHistory.status}\n`;
    }
    if (callerHistory.last_machine) {
      callerContext += `Previously asked about: ${callerHistory.last_machine}\n`;
    }
    callerContext += `Phone: ${callerPhone}`;
  } else {
    callerContext = `New caller (no history)\nPhone: ${callerPhone}`;
  }

  // 5. Build business hours context variable
  let businessHoursContext = '';
  businessHoursContext += `Today's date: ${businessHours.currentDate}\n`;
  businessHoursContext += `Current time: ${businessHours.currentDay}, ${businessHours.currentTime}\n`;
  businessHoursContext += `Office status: ${businessHours.isOpen ? 'OPEN' : 'CLOSED'}\n`;
  businessHoursContext += `\nBUSINESS HOURS SCHEDULE:\n`;
  businessHoursContext += `- Monday-Friday: 8:00 AM to 12:00 PM (noon)\n`;
  businessHoursContext += `- Saturday: 9:00 AM to 3:00 PM\n`;
  businessHoursContext += `- Sunday: CLOSED`;
  if (!businessHours.isOpen && businessHours.nextOpenTime) {
    businessHoursContext += `\n\nNext open: ${businessHours.nextOpenTime}`;
  }
  
  // Add pre-computed dates to prevent AI calendar calculation errors
  businessHoursContext += `\n\nPRE-COMPUTED DATES (use these exact phrases):`;
  if (businessHours.upcomingBusinessDays.tomorrow) {
    businessHoursContext += `\n- Tomorrow: ${businessHours.upcomingBusinessDays.tomorrow}`;
  }
  businessHoursContext += `\n- Next business day: ${businessHours.upcomingBusinessDays.nextBusinessDay}`;
  businessHoursContext += `\n- Next Monday: ${businessHours.upcomingBusinessDays.nextMonday}`;
  businessHoursContext += `\n- Next Tuesday: ${businessHours.upcomingBusinessDays.nextTuesday}`;

  // 6. Additional context (can be customized per client later)
  const additionalContext = client?.additional_context || '';

  return {
    variables: {
      caller_context: callerContext,
      business_hours_context: businessHoursContext,
      additional_context: additionalContext
    },
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
 * Calculate upcoming business days to avoid AI calendar math errors
 */
function calculateUpcomingBusinessDays(currentDate: Date): {
  tomorrow?: string;
  nextBusinessDay: string;
  nextMonday: string;
  nextTuesday: string;
} {
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Phoenix'
  });

  // Find next business day (Monday-Saturday)
  let nextBusinessDay = new Date(currentDate);
  do {
    nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
  } while (nextBusinessDay.getDay() === 0); // Skip Sundays
  
  const nextBusinessDayFormatted = nextBusinessDay.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    timeZone: 'America/Phoenix'
  });

  // Find next Monday
  let nextMonday = new Date(currentDate);
  while (nextMonday.getDay() !== 1) {
    nextMonday.setDate(nextMonday.getDate() + 1);
  }
  if (nextMonday.getTime() <= currentDate.getTime()) {
    nextMonday.setDate(nextMonday.getDate() + 7);
  }
  
  const nextMondayFormatted = nextMonday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric', 
    timeZone: 'America/Phoenix'
  });

  // Find next Tuesday
  let nextTuesday = new Date(currentDate);
  while (nextTuesday.getDay() !== 2) {
    nextTuesday.setDate(nextTuesday.getDate() + 1);
  }
  if (nextTuesday.getTime() <= currentDate.getTime()) {
    nextTuesday.setDate(nextTuesday.getDate() + 7);
  }
  
  const nextTuesdayFormatted = nextTuesday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Phoenix'
  });

  return {
    tomorrow: tomorrow.getDay() === 0 ? undefined : tomorrowFormatted, // Don't suggest Sunday
    nextBusinessDay: nextBusinessDayFormatted,
    nextMonday: nextMondayFormatted,
    nextTuesday: nextTuesdayFormatted
  };
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

  // Get full date string (e.g., "January 2, 2026")
  const currentDate = arizonaTime.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Phoenix'
  });

  const currentTime = arizonaTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Phoenix'
  });

  // Business hours: Monday-Friday 8am-12pm, Saturday 9am-3pm (TESTING: shortened to 12pm for callback testing)
  let isOpen = false;
  let nextOpenTime: string | undefined;

  if (day >= 1 && day <= 5) {
    // Monday-Friday
    isOpen = hour >= 8 && hour < 12;  // TESTING: changed to 12pm (noon) for callback testing
    if (!isOpen && hour < 8) {
      nextOpenTime = `Today at 8:00 AM`;
    } else if (!isOpen && hour >= 12) {
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

  const upcomingBusinessDays = calculateUpcomingBusinessDays(arizonaTime);

  return {
    isOpen,
    currentDay,
    currentDate,
    currentTime,
    nextOpenTime,
    upcomingBusinessDays
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
