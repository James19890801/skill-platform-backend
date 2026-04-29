import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArchitectureNode } from './architecture-node.entity';

@Entity('architecture_files')
export class ArchitectureFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 'process-doc' })
  type: string; // 'sop' | 'process-doc' | 'description' | 'other'

  @Column({ nullable: true, type: 'text' })
  content: string; // 流程说明文本内容

  @Column({ nullable: true })
  fileUrl: string; // 文件URL（如果是上传的文件）

  @Column()
  nodeId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ArchitectureNode, (node) => node.files)
  @JoinColumn({ name: 'nodeId' })
  node: ArchitectureNode;
}
