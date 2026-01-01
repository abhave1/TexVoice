// src/utils/logger.ts
import { FastifyBaseLogger } from 'fastify';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Structured logger utility
 * Provides consistent logging format across the application
 * Writes to both console and log files
 */
export class Logger {
  private logger?: FastifyBaseLogger;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Set the fastify logger instance
   */
  setLogger(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Log incoming call
   */
  inboundCall(phoneNumber: string, recognized: boolean, customerName?: string) {
    const message = recognized
      ? `Inbound call from recognized customer: ${customerName} (${phoneNumber})`
      : `Inbound call from unknown number: ${phoneNumber}`;

    this.info('inbound_call', message, {
      phoneNumber,
      recognized,
      customerName: customerName || 'unknown'
    });
  }

  /**
   * Log tool execution
   */
  toolExecution(toolName: string, args: any, result: string) {
    this.info('tool_execution', `Tool executed: ${toolName}`, {
      tool: toolName,
      arguments: args,
      resultLength: result.length
    });
  }

  /**
   * Log API request to Vapi
   */
  vapiRequest(method: string, endpoint: string, duration?: number) {
    this.info('vapi_request', `Vapi API: ${method} ${endpoint}`, {
      method,
      endpoint,
      duration
    });
  }

  /**
   * Log API error from Vapi
   */
  vapiError(method: string, endpoint: string, error: any) {
    this.error('vapi_error', `Vapi API Error: ${method} ${endpoint}`, {
      method,
      endpoint,
      error: error.message || error
    });
  }

  /**
   * Log customer recognition
   */
  customerRecognized(phoneNumber: string, customer: any) {
    this.info('customer_recognized', `Customer recognized: ${customer.name} from ${customer.company}`, {
      phoneNumber,
      customerName: customer.name,
      company: customer.company,
      status: customer.status
    });
  }

  /**
   * Generic info log
   */
  info(event: string, message: string, metadata?: Record<string, any>) {
    if (this.logger) {
      this.logger.info({ event, ...metadata }, message);
    } else {
      console.log(`[INFO] [${event}] ${message}`, metadata || '');
    }
  }

  /**
   * Generic error log
   */
  error(event: string, message: string, metadata?: Record<string, any>) {
    if (this.logger) {
      this.logger.error({ event, ...metadata }, message);
    } else {
      console.error(`[ERROR] [${event}] ${message}`, metadata || '');
    }
  }

  /**
   * Generic warn log
   */
  warn(event: string, message: string, metadata?: Record<string, any>) {
    if (this.logger) {
      this.logger.warn({ event, ...metadata }, message);
    } else {
      console.warn(`[WARN] [${event}] ${message}`, metadata || '');
    }
  }

  /**
   * Generic debug log
   */
  debug(event: string, message: string, metadata?: Record<string, any>) {
    if (this.logger) {
      this.logger.debug({ event, ...metadata }, message);
    } else {
      console.debug(`[DEBUG] [${event}] ${message}`, metadata || '');
    }
  }

  /**
   * Save JSON data to file for a specific call
   */
  saveJSON(callId: string, filename: string, data: any) {
    try {
      const jsonFile = path.join(LOGS_DIR, `${callId}-${filename}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Saved ${filename} to logs/${callId}-${filename}.json`);
    } catch (error) {
      console.error('Failed to save JSON file:', error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Create a call-specific logger
 */
export function createCallLogger(callId: string) {
  const logFile = path.join(LOGS_DIR, `${callId}.log`);

  const write = (message: string) => {
    console.log(message);
    try {
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  };

  const saveJSON = (filename: string, data: any) => {
    try {
      const jsonFile = path.join(LOGS_DIR, `${callId}-${filename}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Saved to logs/${callId}-${filename}.json`);
    } catch (error) {
      console.error('Failed to save JSON file:', error);
    }
  };

  return { log: write, json: saveJSON };
}

/**
 * Write debug logs to a single debug.log file
 */
export function debugLog(section: string, data: any): void {
  const debugFile = path.join(LOGS_DIR, 'debug.log');
  const timestamp = new Date().toISOString();
  const separator = '━'.repeat(80);

  const logEntry = `
${separator}
[${timestamp}] ${section}
${separator}
${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
${separator}

`;

  try {
    fs.appendFileSync(debugFile, logEntry, 'utf8');
    console.log(`${section}`);
  } catch (error) {
    console.error('Failed to write debug log:', error);
  }
}

