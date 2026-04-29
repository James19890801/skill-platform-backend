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
import { Organization } from './organization.entity';
import { JobModelSkill } from './job-model-skill.entity';
import { Tenant } from './tenant.entity';

@Entity('job_models')
export class JobModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  orgId: number;

  @Column({ default: 1 })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;

  @OneToMany(() => JobModelSkill, (jms) => jms.jobModel)
  skills: JobModelSkill[];

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;
}
