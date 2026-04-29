import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobModel, JobModelSkill, Skill } from '../entities';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JobModel, JobModelSkill, Skill])],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
