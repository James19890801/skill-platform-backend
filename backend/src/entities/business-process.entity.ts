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
import { ProcessDocument } from './process-document.entity';
import { Tenant } from './tenant.entity';

@Entity('business_processes')
export class BusinessProcess {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true })
  archNodeId: number; // 关联的架构节点

  @Column({ default: 'legal' })
  domain: string;

  @Column({ default: 'active' })
  status: string; // 'active' | 'draft' | 'archived'

  @Column({ type: 'integer', default: 0 })
  nodeCount: number;

  @Column({ type: 'integer', default: 0 })
  sopCount: number;

  @Column({ default: 1 })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProcessDocument, (doc) => doc.process)
  documents: ProcessDocument[];

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;
}
