import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildCorsOptions, describeCorsPolicy } from './config/cors.config';
import { isDevelopmentRuntime } from './config/runtime-env.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const corsOptions = buildCorsOptions(config);
  app.enableCors(corsOptions);
  if (isDevelopmentRuntime(config.get<string>('NODE_ENV', 'development'))) {
    Logger.log(describeCorsPolicy(config), 'Bootstrap');
  }
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(config.get<number>('PORT', 3000));
}
bootstrap();
