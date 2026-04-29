import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ArchitectureTree } from './architecture-tree.entity';
import { ArchitectureFile } from './architecture-file.entity';

@Entity('architecture_nodes')
export class ArchitectureNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'integer' })
  level: number; // 1-4

  @Column({ nullable: true })
  parentId: number;

  @Column()
  treeId: number;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 0 })
  sortOrder: number;

  // Skill 覆盖统计（聚合计算）
  @Column({ default: 0 })
  totalSkills: number;

  @Column({ default: 0 })
  coveredSkills: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => ArchitectureTree, (tree) => tree.nodes)
  @JoinColumn({ name: 'treeId' })
  tree: ArchitectureTree;

  @OneToMany(() => ArchitectureFile, (file) => file.node)
  files: ArchitectureFile[];
}
