import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { MessageEntity, RunEntity, ThreadEntity } from '../entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { RunsController } from './runs.controller';
import { ThreadsController } from './threads.controller';
import { ProtocolService } from './protocol.service';
import { RunConcurrencyLimiter } from './run-concurrency-limiter';

@Module({
  imports: [
    TypeOrmModule.forFeature([ThreadEntity, MessageEntity, RunEntity]),
    AiModule,
    NotificationsModule,
  ],
  controllers: [ThreadsController, RunsController],
  providers: [ProtocolService, RunConcurrencyLimiter],
  exports: [ProtocolService],
})
export class ProtocolModule {}
