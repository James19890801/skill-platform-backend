import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('evaluation_runs')
@Index(['suiteId', 'createdAt'])
@Index(['targetType', 'targetId'])
export class EvaluationRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  suiteId: number;

  @Column()
  targetType: string;

  @Column()
  targetId: number;

  @Column()
  targetName: string;

  @Column({ default: 'queued' })
  status: string;

  @Column({ default: 'live' })
  mode: string;

  @Column({ type: 'float', default: 0 })
  score: number;

  @Column({ nullable: true })
  grade: string;

  @Column({ nullable: true })
  targetSnapshotId: number;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
