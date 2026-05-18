import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { McpCategory, McpSource, McpTransport } from '../mcp/mcp.types';

@Entity('mcp_servers')
@Index(['registryId'], { unique: true })
@Index(['updatedAt'])
export class McpServer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  registryId: string;

  @Column()
  name: string;

  @Column({ default: 'custom' })
  category: McpCategory;

  @Column({ default: 'registered' })
  source: McpSource;

  @Column({ default: 'stdio' })
  transport: McpTransport;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  command: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  args: string[];

  @Column({ type: 'simple-json', nullable: true })
  env: Record<string, string> | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'simple-json', nullable: true })
  headers: Record<string, string> | null;

  @Column({ type: 'text', nullable: true })
  package: string | null;

  @Column({ type: 'text', nullable: true })
  referenceUrl: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  capabilities: string[];

  @Column({ type: 'simple-json', default: '[]' })
  requires: string[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'int', nullable: true })
  ownerId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

