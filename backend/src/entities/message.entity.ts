import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('messages')
@Index(['threadId', 'createdAt'])
export class MessageEntity {
  @PrimaryColumn({ length: 80 })
  id: string;

  @Column({ length: 80 })
  threadId: string;

  @Column({ length: 32 })
  role: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: 'text' })
  contentType: string;

  @Column({ type: 'text', nullable: true })
  toolCalls: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;
}
