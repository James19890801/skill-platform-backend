import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter, TransformInterceptor } from './common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 提高 body 解析上限（支持大文件 base64 上传）
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // 启用 CORS - 允许所有来源，特别是前端域名
  app.enableCors({
    origin: [
      'https://e2e-ai.pages.dev',
      'http://localhost:5173',
      'http://localhost:3000',
      /.*/, // 允许所有其他来源（开发环境）
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600, // 预检请求缓存1小时
  });

  // 全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter());

  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 配置 Swagger
  const config = new DocumentBuilder()
    .setTitle('Skill Platform API')
    .setDescription('企业级 Skill 治理平台 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 启动服务
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://0.0.0.0:${port}`);
  console.log(`📚 Swagger documentation: http://0.0.0.0:${port}/api/docs`);

  // 启动后自预热（防止 Railway 冷启动 + 预热 AI 连接）
  setTimeout(async () => {
    try {
      const http = await import('http');
      const req = http.get(`http://0.0.0.0:${port}/api/ai/health`);
      req.on('error', () => {});
      req.end();
    } catch { /* ignore */ }
  }, 1000);
}

bootstrap();
