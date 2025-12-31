import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation (DTO'lar için)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da olmayan alanları sil
      forbidNonWhitelisted: true, // Fazla alan varsa hata ver
      transform: true, // Otomatik type dönüşümü
    })
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Jam Backend API')
    .setDescription('Voice Social Platform API Documentation')
    .setVersion('1.0')
    .addBearerAuth() // JWT token için
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs on http://localhost:${port}/api`);
}
bootstrap();
