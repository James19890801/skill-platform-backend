import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('threads')
export class ThreadEntity {
  @PrimaryColumn({ length: 80 })
  id: string;

  @Column({ nullable: true })
  agentId: number;

  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
