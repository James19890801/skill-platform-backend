import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpServer } from '../entities';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [TypeOrmModule.forFeature([McpServer])],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
