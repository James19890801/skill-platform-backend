import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter, TransformInterceptor } from './common';
import { getRepository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bodyParser from 'body-parser';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '494161546@qq.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '13136092523';

async function ensureAdmin() {
  try {
    const userRepo = getRepository(User);
    let admin = await userRepo.findOne({ where: { email: ADMIN_EMAIL } });
    if (!admin) {
      admin = userRepo.create({
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        isAdmin: true,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
        loginCount: 0,
      });
      await userRepo.save(admin);
      console.log(`✅ 管理员账号已创建: ${ADMIN_EMAIL}`);
    } else if (!admin.isAdmin) {
      admin.isAdmin = true;
      if (admin.phone !== ADMIN_PHONE) {
        admin.phone = ADMIN_PHONE;
      }
      await userRepo.save(admin);
      console.log(`✅ 管理员权限已更新: ${ADMIN_EMAIL}`);
    } else {
      console.log(`✅ 管理员账号正常: ${ADMIN_EMAIL}`);
    }
  } catch (err: any) {
    console.error('⚠️ ensureAdmin 失败（非致命），继续启动:', err?.message || err);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors({
    origin: [
      'https://e2e-ai.pages.dev',
      'http://localhost:5173',
      'http://localhost:3000',
      /.*/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600,
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Skill Platform API')
    .setDescription('企业级 Skill 治理平台 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://0.0.0.0:${port}`);
  console.log(`📚 Swagger documentation: http://0.0.0.0:${port}/api/docs`);

  setTimeout(() => {
    const warmupUrl = `http://0.0.0.0:${port}/api/ai/health`;
    fetch(warmupUrl)
      .then(() => console.log('✅ 预热完成'))
      .catch(() => {});
  }, 1000);

  // 启动后自动确保管理员账号存在
  await ensureAdmin();
}

bootstrap().catch((err) => {
  console.error('❌ Application bootstrap failed:', err);
  process.exit(1);
});

// 全局未捕获异常保护，防止进程意外退出
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
