import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    // origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    // origin: [
    //   'http://localhost:3000',
    //   'https://fixer-frontend-five.vercel.app',
    //   'https://fixxer.com',
    // ],
    origin: true,
    credentials: true,
  });
  app.use(json({ limit: '50mb' }));
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
