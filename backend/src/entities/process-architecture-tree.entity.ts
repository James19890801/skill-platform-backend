import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessArchitectureNode } from './process-architecture-node.entity';

@Entity('process_architecture_trees')
export class ProcessArchitectureTree {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', nullable: true })
  ownerId: number | null;

  @Column({ default: 'local' })
  source: string;

  @Column({ default: '1.0.0' })
  version: string;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProcessArchitectureNode, (node) => node.tree)
  nodes: ProcessArchitectureNode[];
}
