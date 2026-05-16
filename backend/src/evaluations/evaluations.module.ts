import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import {
  Agent,
  CapabilityTree,
  EvaluationBenchmark,
  EvaluationCase,
  EvaluationCaseResult,
  EvaluationRun,
  EvaluationSuite,
  EvaluationTargetSnapshot,
  EvaluationTrace,
  KnowledgeBase,
  ProcessArchitectureNode,
  Skill,
} from '../entities';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({
  imports: [
    AiModule,
    KnowledgeModule,
    LlmModule,
    TypeOrmModule.forFeature([
      EvaluationSuite,
      EvaluationCase,
      EvaluationRun,
      EvaluationCaseResult,
      EvaluationBenchmark,
      EvaluationTargetSnapshot,
      EvaluationTrace,
      Agent,
      Skill,
      KnowledgeBase,
      ProcessArchitectureNode,
      CapabilityTree,
    ]),
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
