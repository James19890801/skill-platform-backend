import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LlmModel } from './llm-model.entity';

@Entity('llm_providers')
export class LlmProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 'openai-compatible' })
  provider: string;

  @Column()
  baseUrl: string;

  @Column({ type: 'text' })
  apiKey: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LlmModel, (model) => model.providerRef)
  models: LlmModel[];
}
