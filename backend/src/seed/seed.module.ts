import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import {
  Tenant,
  Organization,
  User,
  Skill,
  SkillVersion,
  JobModel,
  JobModelSkill,
  SkillReview,
  SkillUsageStat,
  UserSkillClaim,
  ArchitectureTree,
  ArchitectureNode,
  ArchitectureFile,
  BusinessProcess,
  ProcessDocument,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Organization,
      User,
      Skill,
      SkillVersion,
      JobModel,
      JobModelSkill,
      SkillReview,
      SkillUsageStat,
      UserSkillClaim,
      ArchitectureTree,
      ArchitectureNode,
      ArchitectureFile,
      BusinessProcess,
      ProcessDocument,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
