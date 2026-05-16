import { Module } from '@nestjs/common';
import { RunEmailNotificationService } from './run-email-notification.service';

@Module({
  providers: [RunEmailNotificationService],
  exports: [RunEmailNotificationService],
})
export class NotificationsModule {}
