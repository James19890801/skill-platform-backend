import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../entities';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [TypeOrmModule.forFeature([Agent]), McpModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
