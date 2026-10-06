import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EmailClient } from '@azure/communication-email';
import { buildOtpEmail } from './templates/otp-email.template';

@Injectable()
export class AzureEmailService {
  private readonly logger = new Logger(AzureEmailService.name);
  private client: EmailClient | null = null;

  private getClient(): EmailClient {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    if (!connectionString) {
      throw new ServiceUnavailableException(
        'Email OTP is not configured (missing AZURE_COMMUNICATION_CONNECTION_STRING)',
      );
    }
    if (!this.client) {
      this.client = new EmailClient(connectionString);
    }
    return this.client;
  }

  private getSender(): string {
    const sender = process.env.AZURE_EMAIL_SENDER?.trim();
    if (!sender) {
      throw new ServiceUnavailableException(
        'Email OTP is not configured (missing AZURE_EMAIL_SENDER)',
      );
    }
    return sender;
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    const client = this.getClient();
    const sender = this.getSender();
    const content = buildOtpEmail(code, to);

    const message = {
      senderAddress: sender,
      content: {
        subject: content.subject,
        plainText: content.plainText,
        html: content.html,
      },
      recipients: {
        to: [{ address: to }],
      },
    };

    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    if (result.status !== 'Succeeded') {
      this.logger.error(`Azure email send failed: ${result.status}`);
      throw new ServiceUnavailableException('Could not send login email');
    }
  }
}
