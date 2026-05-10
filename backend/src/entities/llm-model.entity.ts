import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LlmProvider } from './llm-provider.entity';

@Entity('llm_models')
export class LlmModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  providerId: number;

  @ManyToOne(() => LlmProvider, (provider) => provider.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'providerId' })
  providerRef: LlmProvider;

  @Index({ unique: true })
  @Column()
  code: string;

  @Column()
  model: string;

  @Column()
  label: string;

  @Column({ default: 'chat' })
  capability: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
