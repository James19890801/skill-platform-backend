import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { ExecutionService } from './execution.service';
import { ToolBridgeService } from './tool-bridge.service';
import { SkillExecutorService } from './skill-executor.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AiController } from './ai.controller';
import { Agent } from '../entities/agent.entity';
import { Skill } from '../entities/skill.entity';
import { SkillExecution } from '../entities/skill-execution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agent, Skill, SkillExecution]), WorkspaceModule],
  providers: [AiService, ExecutionService, ToolBridgeService, SkillExecutorService],
  controllers: [AiController],
  exports: [AiService, ExecutionService, ToolBridgeService, SkillExecutorService],
})
export class AiModule {}
