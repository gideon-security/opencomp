const sendMock = jest.fn();

jest.mock('./aws', () => ({
  sesClient: { send: (...args: unknown[]) => sendMock(...args) },
}));

jest.mock('@aws-sdk/client-ses', () => ({
  SendRawEmailCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ name: 'SendRawEmail', input })),
}));

import { SendRawEmailCommand } from '@aws-sdk/client-ses';
import { sendEmailViaSes } from './ses-client';

function commandInput() {
  return (SendRawEmailCommand as unknown as jest.Mock).mock.calls[0][0];
}

describe('sendEmailViaSes', () => {
  beforeEach(() => {
    sendMock.mockReset();
    (SendRawEmailCommand as unknown as jest.Mock).mockClear();
  });

  it('builds a MIME message with From/To/Subject and returns the MessageId', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-1' });

    const result = await sendEmailViaSes({
      to: 'recipient@example.com',
      from: 'OpenComp <noreply@gideondefender.com>',
      subject: 'Hello',
      html: '<p>hi</p>',
    });

    const input = commandInput();
    expect(input.Source).toBe('OpenComp <noreply@gideondefender.com>');
    expect(input.Destinations).toEqual(['recipient@example.com']);

    const raw = Buffer.from(input.RawMessage.Data).toString('utf8');
    expect(raw).toContain('From: OpenComp <noreply@gideondefender.com>');
    expect(raw).toContain('To: recipient@example.com');
    expect(raw).toContain('Subject: Hello');
    expect(raw).toContain('MIME-Version: 1.0');
    expect(raw).toMatch(/Content-Type: multipart\/mixed; boundary=/);
    expect(result).toEqual({ id: 'ses-1' });
  });

  it('base64-encodes the html body', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-2' });

    await sendEmailViaSes({
      to: 'a@b.com',
      from: 'noreply@x.com',
      subject: 't',
      html: '<p>hi</p>',
    });

    const raw = Buffer.from(commandInput().RawMessage.Data).toString('utf8');
    expect(raw).toContain('Content-Transfer-Encoding: base64');
    expect(raw).toContain(Buffer.from('<p>hi</p>').toString('base64'));
  });

  it('adds custom headers, reply-to and cc', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-3' });

    await sendEmailViaSes({
      to: 'a@b.com',
      from: 'noreply@x.com',
      subject: 't',
      html: '<p>x</p>',
      cc: ['cc@b.com'],
      replyTo: 'reply@x.com',
      headers: {
        'List-Unsubscribe': '<https://x.com/unsub>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    const raw = Buffer.from(commandInput().RawMessage.Data).toString('utf8');
    expect(raw).toContain('Cc: cc@b.com');
    expect(raw).toContain('Reply-To: reply@x.com');
    expect(raw).toContain('List-Unsubscribe: <https://x.com/unsub>');
    expect(raw).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  });

  it('renders each attachment as a base64 multipart part', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-4' });

    const pdfBytes = Buffer.from('%PDF-1.4 fake').toString('base64');
    await sendEmailViaSes({
      to: 'a@b.com',
      from: 'noreply@x.com',
      subject: 't',
      html: '<p>x</p>',
      attachments: [
        { filename: 'doc.pdf', contentType: 'application/pdf', content: pdfBytes },
      ],
    });

    const raw = Buffer.from(commandInput().RawMessage.Data).toString('utf8');
    expect(raw).toContain(
      'Content-Type: application/pdf; name="doc.pdf"',
    );
    expect(raw).toContain('Content-Disposition: attachment; filename="doc.pdf"');
    expect(raw).toContain(pdfBytes);
  });

  it('RFC 2047-encodes a non-ASCII subject', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-5' });

    await sendEmailViaSes({
      to: 'a@b.com',
      from: 'noreply@x.com',
      subject: 'Café ☕',
      html: '<p>x</p>',
    });

    const raw = Buffer.from(commandInput().RawMessage.Data).toString('utf8');
    expect(raw).toContain(
      `Subject: =?UTF-8?B?${Buffer.from('Café ☕').toString('base64')}?=`,
    );
  });

  it('strips CR/LF from header values to prevent injection', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'ses-6' });

    await sendEmailViaSes({
      to: 'a@b.com',
      from: 'noreply@x.com',
      subject: 't',
      html: '<p>x</p>',
      headers: { 'X-Custom': 'safe\r\nBcc: evil@x.com' },
    });

    const raw = Buffer.from(commandInput().RawMessage.Data).toString('utf8');
    expect(raw).toContain('X-Custom: safe Bcc: evil@x.com');
    expect(raw).not.toContain('safe\r\nBcc');
  });
});
