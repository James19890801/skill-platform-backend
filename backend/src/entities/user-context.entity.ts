import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_contexts')
export class UserContext {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  userId: number;

  @Column({ type: 'simple-json', default: '[]' })
  knowledgeBaseIds: number[];

  @Column({ type: 'simple-json', default: '[]' })
  mcpServers: unknown[];

  @Column({ default: true })
  memoryEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
