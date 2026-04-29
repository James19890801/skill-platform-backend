import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Skill, SkillVersion, SkillReview, User } from '../entities';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Skill, SkillVersion, SkillReview, User])],
  controllers: [SkillsController],
  providers: [SkillsService, ApiKeyGuard],
  exports: [SkillsService],
})
export class SkillsModule {}
