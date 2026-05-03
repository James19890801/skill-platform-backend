import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Skill } from './skill.entity';

/**
 * SkillExecution - Skill 执行会话
 *
 * 记录每次 Skill 执行的完整过程，包括：
 * - 执行状态和进度
 * - 输入参数和输出结果
 * - 生成的产物列表（docs, html, files 等）
 * - 执行日志（供调试和审计）
 */
@Entity('skill_executions')
export class SkillExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  skillId: number;

  @Column({ nullable: true })
  threadId: string; // 关联的对话线程 ID

  @Column({ default: 'pending' })
  status: string; // pending | running | completed | failed

  @Column({ type: 'text', nullable: true })
  input: string; // 用户输入的 JSON 参数

  @Column({ type: 'text', nullable: true })
  output: string; // AI 最终输出结果

  @Column({ type: 'text', nullable: true })
  artifacts: string; // JSON: 产物列表 [{name, path, type, size}]

  @Column({ type: 'text', nullable: true })
  logs: string; // JSON: 执行日志 [{step, tool, status, duration, ...}]

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ default: 0 })
  totalRounds: number; // 工具调用轮数

  @Column({ default: 0 })
  totalDurationMs: number; // 总耗时（毫秒）

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Skill;
}
