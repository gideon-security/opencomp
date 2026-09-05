import { UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

function parseSignatureValue(value: string): string {
  // Checkr may send "sha256=<hex>" or raw hex
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('sha256=')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

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

  const normalized = parseSignatureValue(signature);
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  let expectedBuf: Buffer;
  let signatureBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, 'hex');
    signatureBuf = Buffer.from(normalized, 'hex');
  } catch {
    throw new UnauthorizedException('Invalid webhook signature.');
  }

  const matches =
    expectedBuf.length === signatureBuf.length &&
    timingSafeEqual(expectedBuf, signatureBuf);

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

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}
