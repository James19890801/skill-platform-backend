import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Skill,
  Organization,
  ArchitectureTree,
  ArchitectureNode,
  ArchitectureFile,
} from '../entities';
import { ArchitectureService } from './architecture.service';
import { ArchitectureController } from './architecture.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Skill,
      Organization,
      ArchitectureTree,
      ArchitectureNode,
      ArchitectureFile,
    ]),
  ],
  controllers: [ArchitectureController],
  providers: [ArchitectureService],
  exports: [ArchitectureService],
})
export class ArchitectureModule {}
