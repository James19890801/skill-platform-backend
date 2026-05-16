import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('evaluation_case_results')
@Index(['runId'])
@Index(['caseId'])
export class EvaluationCaseResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  runId: number;

  @Column()
  caseId: number;

  @Column({ default: 'passed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  output: string;

  @Column({ type: 'float', default: 0 })
  score: number;

  @Column({ type: 'text', nullable: true })
  metrics: string;

  @Column({ type: 'text', nullable: true })
  evidence: string;

  @Column({ nullable: true })
  traceRef: string;

  @Column({ default: 'pending' })
  reviewStatus: string;

  @Column({ nullable: true })
  reviewerId: number;

  @Column({ type: 'text', nullable: true })
  reviewComment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
