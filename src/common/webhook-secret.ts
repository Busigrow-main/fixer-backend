import { timingSafeEqual } from 'crypto';

export function paymentWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET?.trim() || '';
}

export function webhookSecretMatches(provided: string | undefined): boolean {
  const expected = paymentWebhookSecret();
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
