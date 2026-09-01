import { UnauthorizedException } from '@nestjs/common';
import { headerValue, verifyHmacSignature } from '../utils/webhook-signature';

export { headerValue };

export function verifyCheckrWebhookSignature({
  rawBody,
  headers,
}: {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}): void {
  const secret = process.env.CHECKR_WEBHOOK_SECRET;
  if (!secret) {
    throw new UnauthorizedException('Webhook secret is not configured.');
  }

  const signature = headerValue(headers, 'x-checkr-signature');
  if (!signature) {
    throw new UnauthorizedException('Missing webhook signature header.');
  }

  const matches = verifyHmacSignature({
    rawBody,
    secret,
    providedSignature: signature,
  });
  if (!matches) {
    throw new UnauthorizedException('Invalid webhook signature.');
  }
}

export function verifyBackgroundCheckWebhookSignature({
  rawBody,
  headers,
}: {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}): void {
  verifyCheckrWebhookSignature({ rawBody, headers });
}
