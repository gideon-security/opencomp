/**
 * Universal logger for vector-store code.
 *
 * Tasks run in-process via the local task runner, so NestJS is always
 * available. We prefer the NestJS Logger and fall back to console.log when it
 * cannot be loaded.
 */

type LogPayload = Record<string, unknown> | undefined;

const formatMessage = (message: string, payload?: LogPayload): string => {
  if (!payload) {
    return message;
  }
  try {
    return `${message} ${JSON.stringify(payload)}`;
  } catch {
    return message;
  }
};

const consoleLogger = {
  info: (message: string, payload?: LogPayload): void => {
    console.log(`[VectorStore] ${formatMessage(message, payload)}`);
  },
  warn: (message: string, payload?: LogPayload): void => {
    console.warn(`[VectorStore] ${formatMessage(message, payload)}`);
  },
  error: (message: string, payload?: LogPayload): void => {
    console.error(`[VectorStore] ${formatMessage(message, payload)}`);
  },
};

const createLogger = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger } = require('@nestjs/common');
    const baseLogger = new Logger('VectorStore');

    return {
      info: (message: string, payload?: LogPayload): void => {
        baseLogger.log(formatMessage(message, payload));
      },
      warn: (message: string, payload?: LogPayload): void => {
        baseLogger.warn(formatMessage(message, payload));
      },
      error: (message: string, payload?: LogPayload): void => {
        baseLogger.error(formatMessage(message, payload));
      },
    };
  } catch {
    return consoleLogger;
  }
};

export const logger = createLogger();
