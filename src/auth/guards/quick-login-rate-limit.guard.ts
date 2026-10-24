import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_PHONE = 5;
const MAX_PER_IP = 15;

@Injectable()
export class QuickLoginRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const phone = String(req.body?.phone || '')
      .replace(/\D/g, '')
      .slice(-10);
    const forwarded = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    const ip = forwarded || String(req.ip || 'unknown');
    const now = Date.now();
    const keys = [`ip:${ip}`, ...(phone.length === 10 ? [`phone:${phone}`] : [])];
    const limits = { [`ip:${ip}`]: MAX_PER_IP, [`phone:${phone}`]: MAX_PER_PHONE };

    for (const key of keys) {
      const recent = (this.hits.get(key) || []).filter((at) => now - at < WINDOW_MS);
      if (recent.length >= (limits[key] ?? MAX_PER_PHONE)) {
        throw new HttpException(
          'Too many sign-in attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      recent.push(now);
      this.hits.set(key, recent);
    }
    return true;
  }
}
