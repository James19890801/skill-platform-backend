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
import { User } from './user.entity';
import { Organization } from './organization.entity';
import { SkillVersion } from './skill-version.entity';
import { Tenant } from './tenant.entity';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  namespace: string; // 如 legal.contract.risk-check

  @Column()
  name: string;

  @Column()
  domain: string; // legal/finance/procurement/hr/tech/platform

  @Column()
  subDomain: string; // contract/litigation 等

  @Column()
  abilityName: string; // 能力名称

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'personal' })
  scope: string; // personal | business | platform

  @Column({ default: 'pure-business' })
  type: string; // pure-business | light-tech | heavy-tech

  @Column({ default: 'draft' })
  status: string; // draft | reviewing | published | archived | deprecated

  @Column()
  ownerId: number;

  @Column({ nullable: true })
  orgId: number;

  @Column({ nullable: true })
  sopSource: string; // 溯源到 SOP 文档

  @Column({ default: '1.0.0' })
  currentVersion: string;

  @Column({ default: 1 })
  tenantId: number;

  // === Skill 执行描述（供外部 Agent 调用） ===

  @Column({ default: 'manual' })
  executionType: string; // 'api' | 'webhook' | 'rpa' | 'agent' | 'manual'

  @Column({ nullable: true })
  endpoint: string; // 目标系统的 API 端点，如 https://erp.company.com/api/invoice/verify

  @Column({ nullable: true })
  httpMethod: string; // GET | POST | PUT | DELETE

  @Column({ nullable: true, type: 'text' })
  authConfig: string; // JSON: { type: 'bearer'|'basic'|'apikey'|'oauth2', credentials: {...} }，加密存储

  @Column({ nullable: true, type: 'text' })
  requestTemplate: string; // JSON: 请求模板，支持 {{variable}} 变量替换

  @Column({ nullable: true, type: 'text' })
  responseMapping: string; // JSON: 响应字段映射 { "outputField": "$.data.result" }

  @Column({ nullable: true, type: 'text' })
  headers: string; // JSON: 自定义请求头

  @Column({ nullable: true, type: 'text' })
  errorHandling: string; // JSON: 错误处理策略 { retryCount: 3, retryDelay: 1000, fallback: 'manual' }

  @Column({ nullable: true, type: 'text' })
  content: string; // ★ Skill 标准正文（Markdown 格式）：角色定义、核心职责、输入输出、执行原则等

  @Column({ nullable: true, type: 'text' })
  agentPrompt: string; // 当 executionType='agent' 时，Agent 的 prompt 模板

  @Column({ nullable: true, type: 'text' })
  files: string; // JSON: 捆绑文件列表 [{name, path, type: 'script'|'template'|'reference'|'asset', content}]

  @Column({ nullable: true, type: 'text' })
  toolDefinition: string; // JSON: OpenAI function calling 格式的工具定义，供 Agent 框架直接消费

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;

  @OneToMany(() => SkillVersion, (version) => version.skill)
  versions: SkillVersion[];

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;
}
