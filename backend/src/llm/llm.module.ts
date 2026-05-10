import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmModel, LlmProvider } from '../entities';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([LlmProvider, LlmModel])],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
