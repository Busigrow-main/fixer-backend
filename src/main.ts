import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';
import { setupSwagger } from './common/swagger';
import { jwtSecret } from './common/jwt-secret';

async function bootstrap() {
  try {
    console.log('BOOT: Starting application...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);

    jwtSecret();

    const app = await NestFactory.create(AppModule);

    console.log('BOOT: Nest app created');

    const configured = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const localFrontends = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];
    const origins =
      process.env.NODE_ENV === 'production'
        ? configured
        : [...new Set([...configured, ...localFrontends])];
    app.enableCors({
      origin: origins,
      credentials: true,
    });

    app.use(json({ limit: '10mb' }));

    setupSwagger(app);

    const port = process.env.PORT || 8081;

    await app.listen(port, '0.0.0.0');

    console.log(`BOOT: Server running on ${port}`);
    console.log(`BOOT: Swagger UI at http://localhost:${port}/api/docs`);
  } catch (err) {
    console.error('BOOTSTRAP FATAL ERROR');
    console.error(err);
    process.exit(1);
  }
}

bootstrap();
