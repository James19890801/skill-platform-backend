import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('skill_runtime_events')
@Index(['executionId', 'sequence'], { unique: true })
export class SkillRuntimeEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  executionId: number;

  @Column()
  skillId: number;

  @Column()
  sequence: number;

  @Column()
  eventType: string;

  @Column({ default: 'info' })
  status: string;

  @Column({ type: 'text', nullable: true })
  payload: string;

  @CreateDateColumn()
  createdAt: Date;
}
