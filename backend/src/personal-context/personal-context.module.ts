import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBase, UserContext } from '../entities';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { McpModule } from '../mcp/mcp.module';
import { MemoryModule } from '../memory/memory.module';
import { PersonalContextController } from './personal-context.controller';
import { PersonalContextService } from './personal-context.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserContext, KnowledgeBase]),
    KnowledgeModule,
    MemoryModule,
    McpModule,
  ],
  controllers: [PersonalContextController],
  providers: [PersonalContextService],
  exports: [PersonalContextService],
})
export class PersonalContextModule {}
