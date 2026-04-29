import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArchitectureNode } from './architecture-node.entity';
import { Tenant } from './tenant.entity';

@Entity('architecture_trees')
export class ArchitectureTree {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // 架构名称，如 "企业业务架构 v1.0"

  @Column({ default: '1.0.0' })
  version: string;

  @Column({ nullable: true })
  versionLabel: string; // 版本标签，如 "初始架构"

  @Column({ default: true })
  isActive: boolean; // 是否为当前激活版本

  @Column({ default: 1 })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ArchitectureNode, (node) => node.tree)
  nodes: ArchitectureNode[];

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;
}
