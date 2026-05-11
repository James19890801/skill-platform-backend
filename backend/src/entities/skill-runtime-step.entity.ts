import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

const nullableDateColumnType = process.env.DATABASE_URL || process.env.POSTGRES_DATABASE_URL ? 'timestamp' : 'datetime';

@Entity('skill_runtime_steps')
@Index(['executionId', 'stepKey'])
export class SkillRuntimeStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  executionId: number;

  @Column()
  skillId: number;

  @Column()
  stepKey: string;

  @Column()
  type: string;

  @Column({ type: 'varchar', nullable: true })
  toolName: string | null;

  @Column({ default: 'running' })
  status: string;

  @Column({ type: 'text', nullable: true })
  input: string | null;

  @Column({ type: 'text', nullable: true })
  output: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: nullableDateColumnType, nullable: true })
  startedAt: Date | null;

  @Column({ type: nullableDateColumnType, nullable: true })
  completedAt: Date | null;

  @Column({ default: 0 })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
