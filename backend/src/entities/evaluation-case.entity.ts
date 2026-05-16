import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('evaluation_cases')
@Index(['suiteId'])
@Index(['status'])
export class EvaluationCase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  suiteId: number;

  @Column()
  caseKey: string;

  @Column()
  category: string;

  @Column({ default: 'S0' })
  stage: string;

  @Column({ default: 'L1' })
  level: string;

  @Column({ type: 'text' })
  input: string;

  @Column({ type: 'text', nullable: true })
  expected: string;

  @Column({ type: 'text', nullable: true })
  labels: string;

  @Column({ type: 'text', nullable: true })
  assertions: string;

  @Column({ type: 'float', default: 1 })
  weight: number;

  @Column({ default: 'P1' })
  priority: string;

  @Column({ default: 'generated' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
