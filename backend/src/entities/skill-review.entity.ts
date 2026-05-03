import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Skill } from './skill.entity';
import { User } from './user.entity';

@Entity('skill_reviews')
export class SkillReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  skillId: number;

  @Column()
  submitterId: number;

  @Column({ nullable: true })
  reviewerId: number;

  @Column({ default: 'pending' })
  status: string; // pending | approved | rejected

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column()
  targetScope: string; // 目标层级：personal | business | platform

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitterId' })
  submitter: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;
}
