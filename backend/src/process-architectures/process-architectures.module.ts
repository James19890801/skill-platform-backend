import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Agent,
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  ProcessArchitectureNode,
  ProcessArchitectureTree,
  Skill,
  SkillVersion,
  User,
} from '../entities';
import { ProcessArchitecturesController } from './process-architectures.controller';
import { ProcessArchitecturesService } from './process-architectures.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessArchitectureTree,
      ProcessArchitectureNode,
      Agent,
      Skill,
      SkillVersion,
      User,
      KnowledgeBase,
      KnowledgeDocument,
      KnowledgeChunk,
    ]),
  ],
  controllers: [ProcessArchitecturesController],
  providers: [ProcessArchitecturesService],
  exports: [ProcessArchitecturesService],
})
export class ProcessArchitecturesModule {}
