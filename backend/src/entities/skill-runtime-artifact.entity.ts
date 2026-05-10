import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('skill_runtime_artifacts')
@Index(['executionId'])
export class SkillRuntimeArtifact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  executionId: number;

  @Column()
  skillId: number;

  @Column()
  name: string;

  @Column()
  path: string;

  @Column({ default: 'file' })
  type: string;

  @Column({ default: 0 })
  size: number;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'text', nullable: true })
  metadata: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
