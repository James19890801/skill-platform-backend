import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

@Entity('knowledge_bases')
export class KnowledgeBase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    default: 'local',
  })
  source: string;

  @Column({ type: 'simple-json', default: '[]' })
  documents: string[]; // 文档列表

  @Column({ default: 0 })
  documentCount: number;

  @Column({
    type: 'varchar',
    default: 'connected',
  })
  status: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  tenantId: number;

  @ManyToOne(() => Tenant, { eager: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}