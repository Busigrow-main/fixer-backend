import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const JWT_AUTH = 'access-token';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Fixxer API')
    .setDescription(
      [
        'Customer, shop, admin, and technician APIs.',
        '',
        'Authorize with a JWT from `POST /api/v1/auth/quick-login` or `POST /api/v1/auth/login`.',
        'Technician routes under `/v1/*` use the technician JWT from `POST /v1/auth/verify-otp`.',
        '',
        'Spare-part catalog `price` / `mrp` are **paise**. Shop home, cart, checkout, and appliance prices are **rupees**.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the access_token from login / quick-login / technician verify-otp.',
      },
      JWT_AUTH,
    )
    .addServer('http://localhost:8081', 'Local')
    .addServer('http://135.222.40.140', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
    customSiteTitle: 'Fixxer API',
  });
}
