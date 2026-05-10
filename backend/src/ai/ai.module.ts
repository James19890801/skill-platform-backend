import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { ExecutionService } from './execution.service';
import { ToolBridgeService } from './tool-bridge.service';
import { SkillExecutorService } from './skill-executor.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { AiController } from './ai.controller';
import { Agent } from '../entities/agent.entity';
import { Skill } from '../entities/skill.entity';
import { SkillExecution } from '../entities/skill-execution.entity';
import { SkillRuntimeArtifact, SkillRuntimeEvent, SkillRuntimeStep } from '../entities';
import { SkillLoaderService } from '../skill-runtime/skill-loader.service';
import { SkillResolverService } from '../skill-runtime/skill-resolver.service';
import { SkillRuntimeTraceService } from '../skill-runtime/skill-runtime-trace.service';
import { SkillRuntimeQueueService } from '../skill-runtime/skill-runtime-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      Skill,
      SkillExecution,
      SkillRuntimeArtifact,
      SkillRuntimeEvent,
      SkillRuntimeStep,
    ]),
    WorkspaceModule,
    KnowledgeModule,
    LlmModule,
  ],
  providers: [
    AiService,
    ExecutionService,
    ToolBridgeService,
    SkillExecutorService,
    SkillLoaderService,
    SkillResolverService,
    SkillRuntimeTraceService,
    SkillRuntimeQueueService,
  ],
  controllers: [AiController],
  exports: [
    AiService,
    ExecutionService,
    ToolBridgeService,
    SkillExecutorService,
    SkillLoaderService,
    SkillResolverService,
    SkillRuntimeTraceService,
    SkillRuntimeQueueService,
  ],
})
export class AiModule {}
