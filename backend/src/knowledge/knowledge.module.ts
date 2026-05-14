import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { ProcessArchitectureNode } from '../entities/process-architecture-node.entity';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeBase, KnowledgeDocument, KnowledgeChunk, ProcessArchitectureNode]), MonitoringModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
