import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { KnowledgeBase } from './knowledge-base.entity';

@Index(['knowledgeBaseId', 'status'])
@Entity('knowledge_documents')
export class KnowledgeDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  knowledgeBaseId: number;

  @ManyToOne(() => KnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledgeBaseId' })
  knowledgeBase: KnowledgeBase;

  @Column()
  name: string;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ default: 0 })
  size: number;

  @Column({ default: 'indexed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  textPreview?: string;

  @Column({ default: 0 })
  chunkCount: number;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'simple-json', nullable: true })
  processArchitectureNodeIds?: number[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
