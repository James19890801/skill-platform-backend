import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessProcess, ProcessDocument } from '../entities';
import { ProcessService } from './process.service';
import { ProcessController } from './process.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessProcess, ProcessDocument])],
  controllers: [ProcessController],
  providers: [ProcessService],
  exports: [ProcessService],
})
export class ProcessModule {}
