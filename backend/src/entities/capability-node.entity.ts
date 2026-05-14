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

@Entity('capability_nodes')
@Index(['treeId', 'parentId', 'orderIndex'])
export class CapabilityNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  treeId: number;

  @Column({ type: 'integer', nullable: true })
  parentId: number | null;

  @Column({ default: 'group' })
  nodeType: string; // domain | stage | group | skill

  @Column()
  label: string;

  @Column({ type: 'varchar', nullable: true })
  domain: string | null;

  @Column({ type: 'varchar', nullable: true })
  subDomain: string | null;

  @Column({ type: 'integer', nullable: true })
  skillId: number | null;

  @Column({ type: 'varchar', nullable: true })
  namespace: string | null;

  @Column({ default: 0 })
  orderIndex: number;

  @Column({ type: 'text', nullable: true })
  loopPolicy: string | null;

  @Column({ type: 'text', nullable: true })
  conditionExpression: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => CapabilityTree, (tree) => tree.nodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treeId' })
  tree: CapabilityTree;
}
