// src/utils/logger.ts
import { FastifyBaseLogger } from 'fastify';

/**
 * Structured logger utility
 * Provides consistent logging format across the application
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
}

// Export singleton instance
export const logger = new Logger();
