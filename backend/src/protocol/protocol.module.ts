import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { MessageEntity, RunEntity, ThreadEntity } from '../entities';
import { RunsController } from './runs.controller';
import { ThreadsController } from './threads.controller';
import { ProtocolService } from './protocol.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ThreadEntity, MessageEntity, RunEntity]),
    AiModule,
  ],
  controllers: [ThreadsController, RunsController],
  providers: [ProtocolService],
  exports: [ProtocolService],
})
export class ProtocolModule {}
