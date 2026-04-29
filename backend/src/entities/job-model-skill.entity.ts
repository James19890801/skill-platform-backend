import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobModel } from './job-model.entity';
import { Skill } from './skill.entity';

@Entity('job_model_skills')
export class JobModelSkill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  modelId: number;

  @Column()
  skillId: number;

  @Column({ default: 'required' })
  priority: string; // required | recommended | optional

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => JobModel, (model) => model.skills)
  @JoinColumn({ name: 'modelId' })
  jobModel: JobModel;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;
}
