import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'qwen-plus' })
  model: string;

  @Column({ type: 'text', nullable: true })
  systemPrompt: string;

  @Column({ type: 'text', nullable: true })
  skills: string; // JSON: ['skill-id-1', 'skill-id-2']

  @Column({ type: 'text', nullable: true })
  knowledgeBases: string; // JSON: ['kb-1', 'kb-2']

  @Column({ default: true })
  memoryEnabled: boolean;

  @Column({ type: 'float', default: 0.7 })
  temperature: number;

  @Column({ nullable: true })
  maxTokens: number;

  @Column({ default: 'active' })
  status: string; // active | inactive | archived

  @Column({ nullable: true })
  ownerId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
