import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync, mkdirSync } from 'fs';
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
  KnowledgeBase,
  Memory,
} from './entities';

const configuredDatabasePath = process.env.DATABASE_PATH?.trim() || 'database.sqlite';
const resolvedDatabasePath = isAbsolute(configuredDatabasePath)
  ? configuredDatabasePath
  : join(process.cwd(), configuredDatabasePath);
const databaseDir = dirname(resolvedDatabasePath);

if (!existsSync(databaseDir)) {
  mkdirSync(databaseDir, { recursive: true });
}

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
        KnowledgeBase,
        Memory,
        SkillExecution,
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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
