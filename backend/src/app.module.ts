import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync, mkdirSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { SkillsModule } from './skills/skills.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OrgsModule } from './orgs/orgs.module';
import { ModelsModule } from './models/models.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ArchitectureModule } from './architecture/architecture.module';
import { ProcessModule } from './process/process.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { TenantModule } from './tenant/tenant.module';
import { AgentsModule } from './agents/agents.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MemoryModule } from './memory/memory.module';
import { WorkspaceModule } from './workspace/workspace.module';
import {
  Tenant,
  Organization,
  User,
  Skill,
  SkillVersion,
  SkillExecution,
  JobModel,
  JobModelSkill,
  SkillReview,
  SkillUsageStat,
  UserSkillClaim,
  ArchitectureTree,
  ArchitectureNode,
  ArchitectureFile,
  BusinessProcess,
  ProcessDocument,
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
        Tenant,
        Organization,
        User,
        Skill,
        SkillVersion,
        JobModel,
        JobModelSkill,
        SkillReview,
        SkillUsageStat,
        UserSkillClaim,
        ArchitectureTree,
        ArchitectureNode,
        ArchitectureFile,
        BusinessProcess,
        ProcessDocument,
        Agent,
        KnowledgeBase,
        Memory,
        SkillExecution,
      ],
    }),
    AuthModule,
    SeedModule,
    SkillsModule,
    ReviewsModule,
    OrgsModule,
    ModelsModule,
    DashboardModule,
    ArchitectureModule,
    ProcessModule,
    SearchModule,
    UsersModule,
    AiModule,
    TenantModule,
    AgentsModule,
    KnowledgeModule,
    MemoryModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
