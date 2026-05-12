import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('automation_runs')
@Index(['automationId', 'createdAt'])
export class AutomationRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  automationId: number;

  @Column({ length: 80 })
  threadId: string;

  @Column({ default: 'completed' })
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  @Column({ default: 'manual' })
  trigger: string;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  durationMs: number;

  @Column({ type: 'text', nullable: true })
  input: string;

  @Column({ type: 'text', nullable: true })
  outputPreview: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;
}
