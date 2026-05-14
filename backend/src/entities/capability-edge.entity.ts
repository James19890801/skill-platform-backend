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
import { CapabilityTree } from './capability-tree.entity';

@Entity('capability_edges')
@Index(['treeId', 'sourceNodeId', 'targetNodeId'])
export class CapabilityEdge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  treeId: number;

  @Column()
  sourceNodeId: number;

  @Column()
  targetNodeId: number;

  @Column({ default: 'sequence' })
  edgeType: string; // sequence | parallel | conditional | fallback | loop

  @Column({ type: 'text', nullable: true })
  conditionExpression: string | null;

  @Column({ default: 0 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => CapabilityTree, (tree) => tree.edges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treeId' })
  tree: CapabilityTree;
}
