import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Tenant } from './tenant.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column()
  password: string; // 简化版，存明文或简单hash

  @Column({ default: false })
  verified: boolean; // 邮箱/手机验证状态

  @Column()
  role: string; // admin | manager | member

  @Column({ nullable: true })
  orgId: number;

  @Column({ nullable: true })
  jobTitle: string;

  @Column({ nullable: true })
  apiKey: string; // 用于 Agent API 认证

  @Column({ default: 1 })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;
}
