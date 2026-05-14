import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('operational_events')
@Index(['createdAt'])
@Index(['level', 'createdAt'])
@Index(['category', 'createdAt'])
@Index(['durationMs'])
export class OperationalEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'info' })
  level: 'info' | 'warn' | 'error';

  @Column({ default: 'system' })
  category: string;

  @Column()
  message: string;

  @Column({ nullable: true })
  requestId?: string;

  @Column({ nullable: true })
  method?: string;

  @Column({ nullable: true })
  path?: string;

  @Column({ nullable: true })
  statusCode?: number;

  @Column({ nullable: true })
  durationMs?: number;

  @Column({ nullable: true })
  userId?: number;

  @Column({ type: 'simple-json', nullable: true })
  details?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
