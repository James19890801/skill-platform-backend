import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
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
import { ProtocolModule } from './protocol/protocol.module';
import { OpenAiCompatibleModule } from './openai-compatible/openai-compatible.module';
import { McpModule } from './mcp/mcp.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PersonalContextModule } from './personal-context/personal-context.module';
import { AutomationsModule } from './automations/automations.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { ProcessArchitecturesModule } from './process-architectures/process-architectures.module';
import { ProductWikiModule } from './product-wiki/product-wiki.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
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
  McpServer,
  LlmProvider,
  LlmModel,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeChunk,
  Memory,
  UserContext,
  SkillRuntimeArtifact,
  SkillRuntimeEvent,
  SkillRuntimeStep,
  CapabilityTree,
  CapabilityNode,
  CapabilityEdge,
  ProcessArchitectureTree,
  ProcessArchitectureNode,
  ThreadEntity,
  MessageEntity,
  RunEntity,
  OperationalEvent,
  AutomationTask,
  AutomationRun,
  EvaluationTargetSnapshot,
  EvaluationSuite,
  EvaluationCase,
  EvaluationRun,
  EvaluationCaseResult,
  EvaluationBenchmark,
  EvaluationTrace,
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

const entities = [
  User,
  Skill,
  SkillVersion,
  JobModel,
  JobModelSkill,
  SkillReview,
  SkillUsageStat,
  UserSkillClaim,
  Agent,
  McpServer,
  LlmProvider,
  LlmModel,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeChunk,
  Memory,
  UserContext,
  SkillExecution,
  SkillRuntimeArtifact,
  SkillRuntimeEvent,
  SkillRuntimeStep,
  CapabilityTree,
  CapabilityNode,
  CapabilityEdge,
  ProcessArchitectureTree,
  ProcessArchitectureNode,
  ThreadEntity,
  MessageEntity,
  RunEntity,
  OperationalEvent,
  AutomationTask,
  AutomationRun,
  EvaluationTargetSnapshot,
  EvaluationSuite,
  EvaluationCase,
  EvaluationRun,
  EvaluationCaseResult,
  EvaluationBenchmark,
  EvaluationTrace,
];

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function buildTypeOrmOptions(): TypeOrmModuleOptions {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const synchronize = parseBooleanEnv(process.env.TYPEORM_SYNCHRONIZE, true);

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      ssl: parseBooleanEnv(process.env.DATABASE_SSL, databaseUrl.includes('sslmode=require'))
        ? { rejectUnauthorized: false }
        : false,
      synchronize,
      autoLoadEntities: true,
      logging: process.env.NODE_ENV !== 'production',
      entities,
    };
  }

  return {
    type: 'better-sqlite3',
    database: resolvedDatabasePath,
    synchronize,
    autoLoadEntities: true,
    logging: process.env.NODE_ENV !== 'production',
    entities,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(buildTypeOrmOptions()),
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
    McpModule,
    MonitoringModule,
    PersonalContextModule,
    AutomationsModule,
    CapabilitiesModule,
    ProcessArchitecturesModule,
    ProductWikiModule,
    EvaluationsModule,
    ProtocolModule,
    OpenAiCompatibleModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
