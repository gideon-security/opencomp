import {
  SendRawEmailCommand,
  type RawMessage,
} from '@aws-sdk/client-ses';
import { sesClient } from './aws';
import type { EmailAttachment } from './email-message';

export interface SesSendParams {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  cc?: string | string[];
  replyTo?: string | string[];
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}

function toStringArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function encodeSubject(value: string): string {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
    : value;
}

function toBase64Lines(input: string, maxLineLength = 76): string {
  const encoded = Buffer.from(input, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += maxLineLength) {
    lines.push(encoded.slice(i, i + maxLineLength));
  }
  return lines.join('\r\n');
}

function toAttachmentLine(attachment: EmailAttachment, maxLineLength = 76): string {
  const encoded = attachment.content.replace(/\s+/g, '');
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += maxLineLength) {
    lines.push(encoded.slice(i, i + maxLineLength));
  }
  return lines.join('\r\n');
}

function buildRawMessage(params: SesSendParams): RawMessage {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const lines: string[] = [];

  lines.push(`From: ${sanitizeHeaderValue(params.from)}`);
  lines.push(`To: ${toStringArray(params.to).map(sanitizeHeaderValue).join(',')}`);
  if (params.cc) {
    lines.push(`Cc: ${toStringArray(params.cc).map(sanitizeHeaderValue).join(',')}`);
  }
  lines.push(`Subject: ${encodeSubject(params.subject)}`);
  if (params.replyTo) {
    lines.push(
      `Reply-To: ${toStringArray(params.replyTo).map(sanitizeHeaderValue).join(',')}`,
    );
  }
  if (params.headers) {
    for (const [name, value] of Object.entries(params.headers)) {
      lines.push(`${sanitizeHeaderValue(name)}: ${sanitizeHeaderValue(value)}`);
    }
  }
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(toBase64Lines(params.html));

  if (params.attachments) {
    for (const attachment of params.attachments) {
      const contentType =
        attachment.contentType ?? 'application/octet-stream';
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push(
        `Content-Type: ${sanitizeHeaderValue(contentType)}; name="${sanitizeHeaderValue(attachment.filename)}"`,
      );
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(
        `Content-Disposition: attachment; filename="${sanitizeHeaderValue(attachment.filename)}"`,
      );
      lines.push('');
      lines.push(toAttachmentLine(attachment));
    }
  }

  lines.push('');
  lines.push(`--${boundary}--`);

  return { Data: Buffer.from(lines.join('\r\n') + '\r\n', 'utf8') };
}

export async function sendEmailViaSes(
  params: SesSendParams,
): Promise<{ id: string }> {
  if (!sesClient) {
    throw new Error(
      'SES not initialized - missing AWS credentials or region',
    );
  }

  const { MessageId } = await sesClient.send(
    new SendRawEmailCommand({
      Source: params.from,
      Destinations: toStringArray(params.to),
      RawMessage: buildRawMessage(params),
    }),
  );

  if (!MessageId) {
    throw new Error('SES SendRawEmail succeeded but returned no MessageId');
  }

  return { id: MessageId };
}
