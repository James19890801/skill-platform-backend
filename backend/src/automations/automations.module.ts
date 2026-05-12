import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationRun, AutomationTask } from '../entities';
import { ProtocolModule } from '../protocol/protocol.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';

@Module({
  imports: [TypeOrmModule.forFeature([AutomationTask, AutomationRun]), ProtocolModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
