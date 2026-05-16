import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('evaluation_suites')
@Index(['targetType', 'targetId'])
@Index(['updatedAt'])
export class EvaluationSuite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  targetType: string;

  @Column()
  targetId: number;

  @Column()
  targetName: string;

  @Column({ default: 'L1' })
  level: string;

  @Column({ default: 'S0' })
  stage: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ nullable: true })
  ownerId: number;

  @Column({ type: 'text', nullable: true })
  scoringPolicy: string;

  @Column({ default: 0 })
  caseCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
