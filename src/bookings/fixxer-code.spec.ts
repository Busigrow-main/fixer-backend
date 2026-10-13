import {
  issueFixxerCode,
  decryptFixxerCode,
  fixxerCodesMatch,
  stripFixxerCodeSecrets,
} from './fixxer-code';
import { buildAssignmentEmail } from './templates/bill-email.template';

describe('FIXXER CODE', () => {
  const key = Buffer.alloc(32, 9).toString('base64');

  beforeAll(() => {
    process.env.FIXXER_CODE_KEY = key;
  });

  it('stores ciphertext that is not the digits and decrypts back', () => {
    const issued = issueFixxerCode();
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(issued.fields.fixxerCodeCiphertext).not.toContain(issued.code);
    expect(JSON.stringify(issued.fields)).not.toContain(issued.code);
    expect(decryptFixxerCode(issued.fields)).toBe(issued.code);
  });

  it('rejects a tampered blob and a wrong code', () => {
    const issued = issueFixxerCode();
    expect(decryptFixxerCode({ ...issued.fields, fixxerCodeAuthTag: 'aaaa' })).toBeNull();
    expect(fixxerCodesMatch(issued.code, '000000')).toBe(issued.code === '000000');
    expect(fixxerCodesMatch(issued.code, `${issued.code.slice(0, 3)} ${issued.code.slice(3)}`)).toBe(true);
  });

  it('strips stored secrets and leaves the rest of the booking', () => {
    const issued = issueFixxerCode();
    const doc = stripFixxerCodeSecrets({
      status: 'ASSIGNED',
      ...issued.fields,
    });
    expect(doc.status).toBe('ASSIGNED');
    expect(doc.fixxerCodeCiphertext).toBeUndefined();
    expect(doc.fixxerCodeIv).toBeUndefined();
    expect(doc.fixxerCodeAuthTag).toBeUndefined();
    expect(stripFixxerCodeSecrets(null)).toBeNull();
  });

  it('fails closed when the blob or key is unusable', () => {
    expect(decryptFixxerCode(null)).toBeNull();
    expect(decryptFixxerCode({ fixxerCodeCiphertext: 'aa' })).toBeNull();

    const issued = issueFixxerCode();
    const previous = process.env.FIXXER_CODE_KEY;
    process.env.FIXXER_CODE_KEY = Buffer.alloc(32, 3).toString('base64');
    expect(decryptFixxerCode(issued.fields)).toBeNull();
    delete process.env.FIXXER_CODE_KEY;
    expect(() => issueFixxerCode()).toThrow('32 bytes');
    process.env.FIXXER_CODE_KEY = previous;
  });

  it('accepts a 64-char hex key and ignores spacing in a typed code', () => {
    const previous = process.env.FIXXER_CODE_KEY;
    process.env.FIXXER_CODE_KEY = Buffer.alloc(32, 4).toString('hex');
    const issued = issueFixxerCode();
    expect(decryptFixxerCode(issued.fields)).toBe(issued.code);
    expect(fixxerCodesMatch(issued.code, ` ${issued.code.slice(0, 3)}-${issued.code.slice(3)} `)).toBe(true);
    expect(fixxerCodesMatch(issued.code, '12345')).toBe(false);
    expect(fixxerCodesMatch(null, issued.code)).toBe(false);
    expect(fixxerCodesMatch(issued.code, '')).toBe(false);
    process.env.FIXXER_CODE_KEY = previous;
  });

  it('uses a fresh IV for every code', () => {
    const first = issueFixxerCode();
    const second = issueFixxerCode();
    expect(first.fields.fixxerCodeIv).not.toBe(second.fields.fixxerCodeIv);
    expect(JSON.stringify(first.fields)).not.toContain(first.code);
    expect(JSON.stringify(second.fields)).not.toContain(second.code);
  });

  it('assignment email names the code and has no prices', () => {
    const message = buildAssignmentEmail({
      customerName: 'Abhas',
      repairCode: '#18C8FE',
      serviceName: 'Microwave repair',
      address: 'Boring Road',
      technicianName: 'Surya',
      fixxerCode: '482193',
    });
    expect(message.plainText).toContain('FIXXER CODE: 482193');
    expect(message.html).toContain('FIXXER CODE');
    expect(message.html).not.toContain('₹');
    expect(message.plainText).not.toContain('Cost breakdown');
  });
});
