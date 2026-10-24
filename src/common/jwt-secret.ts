export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET is required');
  }
  return secret;
}
