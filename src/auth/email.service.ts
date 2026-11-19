import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AzureEmailService } from './azure-email.service';
import { buildOtpEmail } from './templates/otp-email.template';

export type EmailAttachment = {
  name: string;
  contentType: string;
  contentInBase64: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  plainText: string;
  html: string;
  attachments?: EmailAttachment[];
};

type Provider = 'ses' | 'azure' | 'none';

/**
 * Sends all customer email (login codes, booking confirmations, bills).
 *
 * Provider is picked by EMAIL_PROVIDER, or automatically:
 *   - "ses"   when SES_FROM_EMAIL is set (Amazon SES; credentials come from the
 *             EC2 instance role, or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY locally)
 *   - "azure" when AZURE_COMMUNICATION_CONNECTION_STRING + AZURE_EMAIL_SENDER are set
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: any = null;

  constructor(private readonly azure: AzureEmailService) {}

  provider(): Provider {
    const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
    if (explicit === 'ses' || explicit === 'azure') return explicit;
    if (process.env.SES_FROM_EMAIL?.trim()) return 'ses';
    if (
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING &&
      process.env.AZURE_EMAIL_SENDER
    ) {
      return 'azure';
    }
    return 'none';
  }

  isConfigured(): boolean {
    return this.provider() !== 'none';
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    const content = buildOtpEmail(code, to);
    await this.sendMessage({
      to,
      subject: content.subject,
      plainText: content.plainText,
      html: content.html,
    });
  }

  async sendMessage(message: EmailMessage): Promise<void> {
    switch (this.provider()) {
      case 'ses':
        return this.sendWithSes(message);
      case 'azure':
        return this.azure.sendMessage(message);
      default:
        throw new ServiceUnavailableException(
          'Email is not configured (set SES_FROM_EMAIL for Amazon SES)',
        );
    }
  }

  // ---------------------------------------------------------------- SES

  private getSesClient() {
    if (!this.sesClient) {
      let sdk: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sdk = require('@aws-sdk/client-sesv2');
      } catch {
        throw new ServiceUnavailableException(
          'Amazon SES SDK missing: run `npm install @aws-sdk/client-sesv2`',
        );
      }
      this.sesClient = {
        sdk,
        client: new sdk.SESv2Client({
          region: process.env.SES_REGION || process.env.AWS_REGION || 'ap-south-1',
        }),
      };
    }
    return this.sesClient as { sdk: any; client: any };
  }

  private async sendWithSes(message: EmailMessage): Promise<void> {
    const from = process.env.SES_FROM_EMAIL?.trim();
    if (!from) {
      throw new ServiceUnavailableException('Email is not configured (missing SES_FROM_EMAIL)');
    }
    const { sdk, client } = this.getSesClient();
    const raw = buildMimeMessage(from, message);
    try {
      await client.send(
        new sdk.SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [message.to] },
          Content: { Raw: { Data: raw } },
          ...(process.env.SES_CONFIGURATION_SET
            ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET }
            : {}),
        }),
      );
    } catch (err: any) {
      this.logger.error(`SES send to ${message.to} failed: ${err?.name}: ${err?.message}`);
      throw new ServiceUnavailableException('Could not send email');
    }
  }
}

// ------------------------------------------------------------------ MIME

const CRLF = '\r\n';

function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, (line) => line + CRLF).trimEnd();
}

function encodeHeader(value: string): string {
  // RFC 2047 so non-ASCII subjects/names (₹, Hindi) survive.
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function encodeAddress(address: string): string {
  const m = address.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!m || !m[1]) return address.trim();
  const name = m[1].replace(/^"|"$/g, '');
  return `${encodeHeader(name)} <${m[2]}>`;
}

function safeFilename(name: string): string {
  return name.replace(/["\r\n]/g, '_');
}

/** Build a multipart MIME message (text + HTML, optional attachments) for SES Raw send. */
export function buildMimeMessage(from: string, msg: EmailMessage): Buffer {
  const mixed = `mixed_${crypto.randomBytes(12).toString('hex')}`;
  const alt = `alt_${crypto.randomBytes(12).toString('hex')}`;
  const b64 = (s: string) => wrap76(Buffer.from(s, 'utf8').toString('base64'));

  const lines: string[] = [
    `From: ${encodeAddress(from)}`,
    `To: ${msg.to}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(msg.plainText || ''),
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(msg.html || ''),
    `--${alt}--`,
  ];

  for (const a of msg.attachments ?? []) {
    const fname = safeFilename(a.name);
    lines.push(
      `--${mixed}`,
      `Content-Type: ${a.contentType}; name="${fname}"`,
      `Content-Disposition: attachment; filename="${fname}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(a.contentInBase64.replace(/\s+/g, '')),
    );
  }
  lines.push(`--${mixed}--`, '');
  return Buffer.from(lines.join(CRLF), 'utf8');
}
