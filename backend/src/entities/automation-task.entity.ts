import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('automation_tasks')
@Index(['status', 'triggerType'])
export class AutomationTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 'time' })
  triggerType: 'time' | 'event' | 'flow';

  @Column({ nullable: true })
  triggerLabel: string;

  @Column({ type: 'text', nullable: true })
  prompt: string;

  @Column({ type: 'text', nullable: true })
  skills: string;

  @Column({ nullable: true })
  agentId: number;

  @Column({ type: 'text', nullable: true })
  orchestration: string;

  @Column({ nullable: true })
  lastRunAt: Date;

  @Column({ nullable: true })
  nextRunAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
