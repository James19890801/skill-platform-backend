import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessProcess } from './business-process.entity';

@Entity('process_documents')
export class ProcessDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 'sop' })
  type: string; // 'sop' | 'manual' | 'spec'

  @Column({ nullable: true, type: 'text' })
  content: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column()
  processId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => BusinessProcess, (process) => process.documents)
  @JoinColumn({ name: 'processId' })
  process: BusinessProcess;
}
