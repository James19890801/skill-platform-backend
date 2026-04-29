import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Skill } from './skill.entity';

@Entity('user_skill_claims')
export class UserSkillClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  skillId: number;

  @Column({ nullable: true })
  modelId: number; // 通过哪个 Model 认领的

  @CreateDateColumn()
  claimedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;
}
