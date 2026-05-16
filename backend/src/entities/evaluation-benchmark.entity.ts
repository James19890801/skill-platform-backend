import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('evaluation_benchmarks')
@Index(['targetType', 'targetId'])
@Index(['status'])
export class EvaluationBenchmark {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  targetType: string;

  @Column()
  targetId: number;

  @Column()
  targetName: string;

  @Column()
  name: string;

  @Column()
  version: string;

  @Column({ default: 'active' })
  status: string;

  @Column()
  runId: number;

  @Column({ type: 'float', default: 0 })
  score: number;

  @Column({ nullable: true })
  grade: string;

  @Column({ type: 'text', nullable: true })
  method: string;

  @Column({ type: 'text', nullable: true })
  artifactIndex: string;

  @Column({ nullable: true })
  promotedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
