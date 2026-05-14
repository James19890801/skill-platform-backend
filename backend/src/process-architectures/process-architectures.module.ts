import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Agent,
  KnowledgeDocument,
  ProcessArchitectureNode,
  ProcessArchitectureTree,
  Skill,
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
      KnowledgeDocument,
    ]),
  ],
  controllers: [ProcessArchitecturesController],
  providers: [ProcessArchitecturesService],
  exports: [ProcessArchitecturesService],
})
export class ProcessArchitecturesModule {}
