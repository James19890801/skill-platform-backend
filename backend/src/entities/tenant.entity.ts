import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // 企业/租户名称

  @Column({ unique: true })
  code: string; // 租户编码，如 "acme-corp"

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ default: 'active' })
  status: string; // active | suspended | trial

  @Column({ default: 'free' })
  plan: string; // free | basic | pro | enterprise

  // 钉钉集成配置
  @Column({ nullable: true })
  dingtalkCorpId: string;

  @Column({ nullable: true })
  dingtalkAppKey: string;

  @Column({ nullable: true })
  dingtalkAppSecret: string;

  // 企微集成配置
  @Column({ nullable: true })
  wecomCorpId: string;

  @Column({ nullable: true })
  wecomSecret: string;

  @Column({ nullable: true, type: 'text' })
  settings: string; // JSON: 自定义配置

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
