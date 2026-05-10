import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { SkillsModule } from './skills/skills.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ModelsModule } from './models/models.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { AgentsModule } from './agents/agents.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MemoryModule } from './memory/memory.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { LlmModule } from './llm/llm.module';
import {
  User,
  Skill,
  SkillVersion,
  SkillExecution,
  JobModel,
  JobModelSkill,
  SkillReview,
  SkillUsageStat,
  UserSkillClaim,
  Agent,
  LlmProvider,
  LlmModel,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeChunk,
  Memory,
  SkillRuntimeArtifact,
  SkillRuntimeEvent,
  SkillRuntimeStep,
} from './entities';

const configuredDatabasePath = process.env.DATABASE_PATH?.trim() || 'database.sqlite';
const resolvedDatabasePath = isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : join(process.cwd(), configuredDatabasePath);
const databaseDir = dirname(resolvedDatabasePath);

if (!existsSync(databaseDir)) {
  mkdirSync(databaseDir, { recursive: true });
}

function backupDatabaseIfPresent(databasePath: string) {
  try {
    if (!existsSync(databasePath) || statSync(databasePath).size === 0) {
      return;
    }

    const backupDir = join(dirname(databasePath), 'db-backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    copyFileSync(databasePath, join(backupDir, `database.${stamp}.sqlite`));

    const backups = readdirSync(backupDir)
      .filter((name) => name.endsWith('.sqlite'))
      .sort();
    const staleBackups = backups.slice(0, Math.max(0, backups.length - 10));
    for (const backup of staleBackups) {
      unlinkSync(join(backupDir, backup));
    }
  } catch (err) {
    console.warn('⚠️ 数据库启动前备份失败（非致命）:', err instanceof Error ? err.message : err);
  }
}

backupDatabaseIfPresent(resolvedDatabasePath);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: resolvedDatabasePath,
      synchronize: true,
      autoLoadEntities: true,
      logging: process.env.NODE_ENV !== 'production',
      entities: [
        User,
        Skill,
        SkillVersion,
        JobModel,
        JobModelSkill,
        SkillReview,
        SkillUsageStat,
        UserSkillClaim,
        Agent,
        LlmProvider,
        LlmModel,
        KnowledgeBase,
        KnowledgeDocument,
        KnowledgeChunk,
        Memory,
        SkillExecution,
        SkillRuntimeArtifact,
        SkillRuntimeEvent,
        SkillRuntimeStep,
      ],
    }),
    AuthModule,
    SkillsModule,
    ReviewsModule,
    ModelsModule,
    DashboardModule,
    SearchModule,
    UsersModule,
    AiModule,
    AgentsModule,
    KnowledgeModule,
    MemoryModule,
    WorkspaceModule,
    LlmModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
