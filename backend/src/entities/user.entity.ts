import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true, default: null })
  phone: string;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ type: 'datetime', nullable: true })
  firstLoginAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date;

  @Column({ default: 0 })
  loginCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
