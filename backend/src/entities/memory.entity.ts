import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('memories')
export class Memory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  agentId?: number | null;

  @Column({ type: 'int', nullable: true })
  userId?: number | null;

  @Column({ type: 'varchar', length: 24, default: 'agent' })
  scope: 'agent' | 'user';

  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 50, default: 'fact' })
  category: string; // preference | fact | context

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
