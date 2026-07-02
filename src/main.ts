import 'tsconfig-paths/register';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //enable graceful shutdowns for the application
  app.enableShutdownHooks();

  // ✅ Allowed Frontend Origins
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://vaf-frontend.vercel.app',
    'https://vinitabbedyafoundation.com',
    'https://www.vinitabhedyafoundation.com'
  ];

  // ✅ CORS
  app.enableCors({
    origin: (origin, callback) => {
      // allow mobile apps / postman / server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked for origin: ${origin}`),
        false,
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  });

  // ✅ Security Headers
  app.use(helmet());

  // ✅ Global API Prefix
  app.setGlobalPrefix('api');

  // ✅ Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ Swagger (only for development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Attendance-Marking REST API')
      .setDescription('Volunteer management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('swagger', app, document);
  }

  // ✅ Start Server
  const PORT = process.env.PORT || 3000;

  await app.listen(PORT);

const logger = new Logger('Bootstrap');

logger.log(
  `Server running on port ${PORT}`,
);
}

bootstrap();