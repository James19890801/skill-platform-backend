import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CapabilityNode } from './capability-node.entity';
import { CapabilityEdge } from './capability-edge.entity';

@Entity('capability_trees')
export class CapabilityTree {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  ownerId: number;

  @Column({ default: 'business' })
  scope: string;

  @Column({ default: '1.0.0' })
  version: string;

  @Column({ default: 'draft' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CapabilityNode, (node) => node.tree)
  nodes: CapabilityNode[];

  @OneToMany(() => CapabilityEdge, (edge) => edge.tree)
  edges: CapabilityEdge[];
}
