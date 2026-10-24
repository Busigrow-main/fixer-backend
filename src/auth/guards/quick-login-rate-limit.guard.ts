import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_KEY = 5;

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
    const key = phone.length === 10 ? `phone:${phone}` : `ip:${ip}`;
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((at) => now - at < WINDOW_MS);
    if (recent.length >= MAX_PER_KEY) {
      throw new HttpException(
        'Too many sign-in attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
