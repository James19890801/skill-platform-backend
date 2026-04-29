import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Skill } from './skill.entity';

@Entity('skill_usage_stats')
export class SkillUsageStat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  skillId: number;

  @Column({ default: 0 })
  callCount: number;

  @Column({ type: 'float', default: 100 })
  successRate: number;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column({ nullable: true })
  lastCalledBy: string; // user | agent | system

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;
}
