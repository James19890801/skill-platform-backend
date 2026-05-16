import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('runs')
@Index(['threadId', 'createdAt'])
export class RunEntity {
  @PrimaryColumn({ length: 80 })
  id: string;

  @Column({ length: 80, nullable: true })
  threadId: string;

  @Column({ nullable: true })
  agentId: number;

  @Column({ nullable: true, select: false })
  userId: number;

  @Column({ length: 320, nullable: true, select: false })
  notifyEmail: string;

  @Column({ default: 'queued' })
  status: string;

  @Column({ type: 'text', nullable: true })
  input: string;

  @Column({ type: 'text', nullable: true })
  output: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'text', nullable: true })
  usage: string;

  @Column({ length: 40, nullable: true })
  notificationStatus: string;

  @Column({ length: 120, nullable: true })
  notificationReason: string;

  @Column({ nullable: true })
  notificationSentAt: Date;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
