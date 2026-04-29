import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Skill } from './skill.entity';

@Entity('skill_versions')
export class SkillVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  skillId: number;

  @Column()
  version: string; // 语义化版本号

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-json', nullable: true })
  input: any; // 输入定义 JSON

  @Column({ type: 'simple-json', nullable: true })
  output: any; // 输出定义 JSON

  @Column({ type: 'simple-json', nullable: true })
  dependencies: string[]; // 依赖的 Skill namespace 列表

  @Column({ type: 'text', nullable: true })
  changelog: string;

  @Column({ default: true })
  isLatest: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Skill, (skill) => skill.versions)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;
}
