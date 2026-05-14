import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessArchitectureTree } from './process-architecture-tree.entity';

@Entity('process_architecture_nodes')
@Index(['treeId', 'parentId', 'sortOrder'])
export class ProcessArchitectureNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  treeId: number;

  @Column({ type: 'integer', nullable: true })
  parentId: number | null;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column()
  name: string;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => ProcessArchitectureTree, (tree) => tree.nodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treeId' })
  tree: ProcessArchitectureTree;
}
