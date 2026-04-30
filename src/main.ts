import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { JsonLogger } from './common/logger/json-logger.service';

async function bootstrap() {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(isProduction ? 'log' : 'debug'),
  });

  const configService = app.get(ConfigService);
  const sentryDsn = configService.get<string>('SENTRY_DSN_BACKEND');

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.get<string>('NODE_ENV', 'development'),
    });
  }

  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  if (corsOrigins && corsOrigins !== '*') {
    const allowedOrigins = corsOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-admin-token'],
      credentials: true,
    });
  } else if (!isProduction) {
    app.enableCors({ origin: true });
  }

  app.use(compression());
  app.use(RequestIdMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Stylo AI API')
    .setDescription('Backend API for Stylo AI')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  process.stdout.write(JSON.stringify({ level: 'log', ts: new Date().toISOString(), msg: `Application running on port ${port}` }) + '\n');
}

bootstrap();
