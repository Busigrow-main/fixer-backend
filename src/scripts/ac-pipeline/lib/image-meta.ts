import * as crypto from 'crypto';
import * as fs from 'fs';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageValidationOptions {
  minBytes?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface ImageValidationResult {
  ok: boolean;
  bytes: number;
  dimensions?: ImageDimensions;
  reason?: string;
}

export function readImageDimensions(filePath: string): ImageDimensions | null {
  const buf = fs.readFileSync(filePath);
  return readDimensionsFromBuffer(buf);
}

export function readDimensionsFromBuffer(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24) return null;

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
        };
      }
      i += 2 + len;
    }
  }

  // WebP (lossy VP8)
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && buf.length >= 30) {
      return {
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

export function validateImageFile(
  filePath: string,
  opts: ImageValidationOptions,
): ImageValidationResult {
  const minBytes = opts.minBytes ?? 8_000;
  const minWidth = opts.minWidth ?? 400;
  const minHeight = opts.minHeight ?? 400;

  if (!fs.existsSync(filePath)) {
    return { ok: false, bytes: 0, reason: 'missing' };
  }

  const bytes = fs.statSync(filePath).size;
  if (bytes < minBytes) {
    return { ok: false, bytes, reason: `file too small (${bytes} < ${minBytes} bytes)` };
  }

  const dimensions = readImageDimensions(filePath);
  if (!dimensions) {
    return { ok: false, bytes, reason: 'could not read image dimensions' };
  }

  if (dimensions.width < minWidth || dimensions.height < minHeight) {
    return {
      ok: false,
      bytes,
      dimensions,
      reason: `dimensions too small (${dimensions.width}x${dimensions.height}, need ${minWidth}x${minHeight})`,
    };
  }

  return { ok: true, bytes, dimensions };
}

export function fileSha256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}
