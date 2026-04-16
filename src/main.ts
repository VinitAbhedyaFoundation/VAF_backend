import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'tsconfig-paths/register';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Smarter CORS (works in dev + production)
  app.enableCors({
    origin: process.env.FRONTEND_URL || true,
  });

  // ✅ Global validation (strict + secure)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ Swagger config
  const config = new DocumentBuilder()
    .setTitle('Attendance-Marking REST API')
    .setDescription(
      'API for marking attendance of ploggers, managing users and roles',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ✅ Clean route
  SwaggerModule.setup('swagger', app, document);

  // ✅ Flexible port
  await app.listen(process.env.PORT || 3000);
}
bootstrap();