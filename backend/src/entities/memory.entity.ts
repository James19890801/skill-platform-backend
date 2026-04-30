import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('memories')
export class Memory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  agentId: number;

  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 50, default: 'fact' })
  category: string; // preference | fact | context

  @Column({ type: 'int', default: 1 })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
