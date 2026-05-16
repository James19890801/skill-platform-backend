import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('evaluation_traces')
@Index(['runId'])
@Index(['caseResultId'])
export class EvaluationTrace {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  runId: number;

  @Column({ nullable: true })
  caseResultId: number;

  @Column({ default: 'live' })
  traceType: string;

  @Column({ type: 'text', nullable: true })
  events: string;

  @Column({ type: 'text', nullable: true })
  toolCalls: string;

  @Column({ type: 'text', nullable: true })
  sources: string;

  @Column({ type: 'text', nullable: true })
  artifacts: string;

  @CreateDateColumn()
  createdAt: Date;
}
