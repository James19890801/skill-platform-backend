import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationalEvent } from '../entities/operational-event.entity';
import { EmailAlertService } from './email-alert.service';
import { MonitoringController } from './monitoring.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [TypeOrmModule.forFeature([OperationalEvent])],
  controllers: [MonitoringController],
  providers: [ObservabilityService, EmailAlertService],
  exports: [ObservabilityService],
})
export class MonitoringModule {}
