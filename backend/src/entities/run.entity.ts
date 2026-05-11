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

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
