import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('evaluation_target_snapshots')
@Index(['targetType', 'targetId'])
export class EvaluationTargetSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  targetType: string;

  @Column()
  targetId: number;

  @Column()
  targetName: string;

  @Column({ nullable: true })
  targetVersion: string;

  @Column({ type: 'text' })
  snapshotJson: string;

  @CreateDateColumn()
  createdAt: Date;
}
