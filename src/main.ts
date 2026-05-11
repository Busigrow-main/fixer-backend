import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  try {
    console.log('BOOT: Starting application...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);

    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('FATAL: JWT_SECRET missing');
    }

    const app = await NestFactory.create(AppModule);

    console.log('BOOT: Nest app created');

    app.enableCors({
      origin: true,
      credentials: true,
    });

    app.use(json({ limit: '10mb' }));

    const port = process.env.PORT || 8080;

    await app.listen(port, '0.0.0.0');

    console.log(`BOOT: Server running on ${port}`);
  } catch (err) {
    console.error('BOOTSTRAP FATAL ERROR');
    console.error(err);
    process.exit(1);
  }
}

bootstrap();