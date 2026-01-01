// src/services/context-builder.service.ts
import { databaseService } from './database.service';

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

interface AvailableStaff {
  sales: string[];
  rentals: string[];
  service: string[];
  parts: string[];
  billing: string[];
  onCallTech?: string;
}

/**
 * Build dynamic system message context for a call
 * This gets injected as a transient override to the permanent assistant
 */
export async function buildDynamicContext(context: CallContext): Promise<{
  contextMessage: string;
  isAfterHours: boolean;
}> {
  const { callerPhone, clientId } = context;

  // 1. Look up caller history
  const callerHistory = await getCallerHistory(callerPhone);

  // 2. Check business hours
  const businessHours = getBusinessHoursInfo();

  // 3. Get available staff (mock for now - would integrate with scheduling system)
  const availableStaff = await getAvailableStaff(clientId, businessHours.isOpen);

  // 4. Build the context string
  let contextMessage = `CURRENT CALL CONTEXT:\n\n`;

  // === CALLER HISTORY ===
  if (callerHistory.name) {
    contextMessage += `CALLER INFORMATION:\n`;
    contextMessage += `- Name: ${callerHistory.name}\n`;
    if (callerHistory.company) {
      contextMessage += `- Company: ${callerHistory.company}\n`;
    }
    contextMessage += `- Status: ${callerHistory.status || 'Regular'}\n`;
    if (callerHistory.last_machine) {
      contextMessage += `- Last inquiry: ${callerHistory.last_machine}\n`;
    }
    contextMessage += `- Total calls: ${callerHistory.total_calls || 1}\n`;
    if (callerHistory.total_calls && callerHistory.total_calls > 1) {
      contextMessage += `- Last contact: ${callerHistory.last_call_at ? new Date(callerHistory.last_call_at).toLocaleDateString() : 'recently'}\n`;
    }
    contextMessage += `\n`;
  } else {
    contextMessage += `CALLER INFORMATION:\n`;
    contextMessage += `- New caller (no history)\n`;
    contextMessage += `- Be sure to capture their name and company\n\n`;
  }

  // === BUSINESS HOURS & STAFFING ===
  contextMessage += `BUSINESS STATUS:\n`;
  contextMessage += `- Current time: ${businessHours.currentDay}, ${businessHours.currentTime}\n`;
  contextMessage += `- Status: ${businessHours.isOpen ? 'OPEN' : 'CLOSED'}\n`;

  if (businessHours.isOpen) {
    contextMessage += `\nAVAILABLE STAFF NOW:\n`;
    if (availableStaff.sales.length > 0) {
      contextMessage += `- Sales: ${availableStaff.sales.join(', ')}\n`;
    }
    if (availableStaff.rentals.length > 0) {
      contextMessage += `- Rentals: ${availableStaff.rentals.join(', ')}\n`;
    }
    if (availableStaff.service.length > 0) {
      contextMessage += `- Service: ${availableStaff.service.join(', ')}\n`;
    }
    if (availableStaff.parts.length > 0) {
      contextMessage += `- Parts: ${availableStaff.parts.join(', ')}\n`;
    }
    contextMessage += `\n`;
  } else {
    contextMessage += `\nAFTER-HOURS MODE:\n`;
    contextMessage += `- Take detailed message and contact information\n`;
    contextMessage += `- Schedule callback for next business day\n`;
    if (availableStaff.onCallTech) {
      contextMessage += `- Emergency service: ${availableStaff.onCallTech} available\n`;
    }
    if (businessHours.nextOpenTime) {
      contextMessage += `- Next open: ${businessHours.nextOpenTime}\n`;
    }
    contextMessage += `\n`;
  }

  // === PERSONA-SPECIFIC GUIDANCE ===
  contextMessage += getPersonaGuidance(businessHours, callerHistory);

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
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = dayNames[day];
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Business hours: Monday-Friday 8am-6pm, Saturday 9am-3pm
  let isOpen = false;
  let nextOpenTime: string | undefined;

  if (day >= 1 && day <= 5) {
    // Monday-Friday
    isOpen = hour >= 8 && hour < 18;
    if (!isOpen && hour < 8) {
      nextOpenTime = `Today at 8:00 AM`;
    } else if (!isOpen && hour >= 18) {
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
 * Get available staff
 * TODO: Integrate with scheduling system or client configuration
 */
async function getAvailableStaff(_clientId: string, isOpen: boolean): Promise<AvailableStaff> {
  // Mock data - in production this would query a scheduling system
  if (isOpen) {
    return {
      sales: ['Mike', 'Sarah'],
      rentals: ['Tom', 'Lisa'],
      service: ['Dave', 'Carlos'],
      parts: ['Jenny'],
      billing: ['Rachel']
    };
  } else {
    return {
      sales: [],
      rentals: [],
      service: [],
      parts: [],
      billing: [],
      onCallTech: 'Emergency Service: (602) 570-5474'
    };
  }
}

/**
 * Get persona-specific guidance based on time and caller
 */
function getPersonaGuidance(_businessHours: BusinessHoursInfo, callerHistory: CallerHistory): string {
  let guidance = `CALL HANDLING GUIDANCE:\n`;

  const hour = new Date().getHours();

  // Time-based patterns
  if (hour >= 6 && hour < 10) {
    guidance += `- MORNING PATTERN: Service calls common (breakdowns overnight)\n`;
    guidance += `- Be ready to route to service department quickly\n`;
    guidance += `- Ask about urgency and if machine is down NOW\n`;
  } else if (hour >= 16 && hour < 19) {
    guidance += `- LATE DAY PATTERN: Rental requests for tomorrow are common\n`;
    guidance += `- Confirm delivery needs and jobsite location early\n`;
    guidance += `- Sales calls may be pre-research for next-day decisions\n`;
  } else if (hour >= 11 && hour < 14) {
    guidance += `- MIDDAY PATTERN: Mix of all call types\n`;
    guidance += `- Parts counter gets busy during lunch\n`;
  }

  // Caller history patterns
  if (callerHistory.status === 'VIP') {
    guidance += `- VIP CUSTOMER: Prioritize fast routing, warm transfer\n`;
    guidance += `- Mention their VIP status during handoff\n`;
  }

  if (callerHistory.last_machine) {
    guidance += `- RETURNING CUSTOMER: Reference their last inquiry if relevant\n`;
    guidance += `- Example: "I see you were asking about ${callerHistory.last_machine} last time"\n`;
  }

  guidance += `\nKEY PERSONAS TO WATCH FOR:\n`;
  guidance += `1. BUYER: Looking for specific machine → Capture make/model/location/budget\n`;
  guidance += `2. RENTAL CUSTOMER: Needs equipment ASAP → Capture jobsite/date/duration\n`;
  guidance += `3. SERVICE: Machine down → Capture symptoms/location/urgency\n`;
  guidance += `4. PARTS: Needs components → Capture machine type/part description\n`;
  guidance += `5. FLEET MANAGER: Exploring options → Clarify intent in 2 questions\n`;

  return guidance;
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
