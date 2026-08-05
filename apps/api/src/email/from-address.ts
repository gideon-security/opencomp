import type { EmailChannel } from './email-message';

function readFromEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function resolveFromAddress(
  channel?: EmailChannel,
): string | undefined {
  const system = readFromEnv('EMAIL_FROM_SYSTEM');
  const marketing = readFromEnv('EMAIL_FROM_MARKETING');
  const trustPortal = readFromEnv('EMAIL_FROM_TRUST_PORTAL');
  const fallback = readFromEnv('EMAIL_FROM_DEFAULT');

  switch (channel) {
    case 'trustPortal':
      return trustPortal ?? system;
    case 'marketing':
      return marketing ?? system;
    case 'system':
      return system;
    case 'default':
      return fallback ?? system;
    default:
      return system ?? fallback;
  }
}

export function defaultFromAddress(): string | undefined {
  return readFromEnv('EMAIL_FROM_SYSTEM') ?? readFromEnv('EMAIL_FROM_DEFAULT');
}
