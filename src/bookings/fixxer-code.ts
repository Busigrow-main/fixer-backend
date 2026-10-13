import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';

const SECRET_FIELDS = [
  'fixxerCodeCiphertext',
  'fixxerCodeIv',
  'fixxerCodeAuthTag',
] as const;

export type FixxerCodeFields = {
  fixxerCodeCiphertext: string;
  fixxerCodeIv: string;
  fixxerCodeAuthTag: string;
  fixxerCodeIssuedAt: Date;
};

export function stripFixxerCodeSecrets<T extends Record<string, any> | null | undefined>(
  doc: T,
): T {
  if (!doc || typeof doc !== 'object') return doc;
  for (const field of SECRET_FIELDS) {
    delete (doc as Record<string, unknown>)[field];
  }
  return doc;
}

function encryptionKey(): Buffer {
  const raw = String(process.env.FIXXER_CODE_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');

  const asBase64 = Buffer.from(raw, 'base64');
  if (raw && asBase64.length === 32) return asBase64;

  const asUtf8 = Buffer.from(raw, 'utf8');
  if (asUtf8.length === 32) return asUtf8;

  throw new Error('FIXXER_CODE_KEY must be 32 bytes');
}

export function issueFixxerCode(): { code: string; fields: FixxerCodeFields } {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return {
    code,
    fields: {
      fixxerCodeCiphertext: ciphertext.toString('base64'),
      fixxerCodeIv: iv.toString('base64'),
      fixxerCodeAuthTag: cipher.getAuthTag().toString('base64'),
      fixxerCodeIssuedAt: new Date(),
    },
  };
}

export function decryptFixxerCode(booking: {
  fixxerCodeCiphertext?: string;
  fixxerCodeIv?: string;
  fixxerCodeAuthTag?: string;
} | null | undefined): string | null {
  if (!booking?.fixxerCodeCiphertext || !booking.fixxerCodeIv || !booking.fixxerCodeAuthTag) {
    return null;
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(booking.fixxerCodeIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(booking.fixxerCodeAuthTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(booking.fixxerCodeCiphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export function fixxerCodesMatch(stored: string | null, submitted: unknown): boolean {
  const left = String(stored || '').replace(/\D/g, '');
  const right = String(submitted || '').replace(/\D/g, '');
  if (left.length !== 6 || right.length !== 6) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
