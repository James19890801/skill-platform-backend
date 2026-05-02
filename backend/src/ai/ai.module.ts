import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { ExecutionService } from './execution.service';
import { AiController } from './ai.controller';
import { Agent } from '../entities/agent.entity';
import { Skill } from '../entities/skill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agent, Skill])],
  providers: [AiService, ExecutionService],
  controllers: [AiController],
  exports: [AiService, ExecutionService],
})
export class AiModule {}
