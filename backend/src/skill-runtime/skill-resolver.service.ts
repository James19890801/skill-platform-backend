import { Injectable } from '@nestjs/common';
import { SkillCandidate, resolveSkillCandidates } from './skill-package';
import { SkillLoaderService } from './skill-loader.service';

@Injectable()
export class SkillResolverService {
  constructor(private readonly loader: SkillLoaderService) {}

  async resolve(input: string, explicitSkills: string[] = [], limit = 5): Promise<SkillCandidate[]> {
    const packages = await this.loader.listPublishedPackages(100);
    return resolveSkillCandidates(
      packages.map(({ pkg }) => pkg),
      { input, explicitSkills, limit },
    );
  }
}
