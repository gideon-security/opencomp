/**
 * Application logger.
 * Only logs in development to avoid leaking info in production.
 */
export const logger = (message: string, params?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
     
    console.log(message, params);
  }
};
