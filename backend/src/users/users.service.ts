import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // 检查邮箱或手机号是否已存在
    if (createUserDto.email) {
      const existingEmailUser = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      });
      if (existingEmailUser) {
        throw new BadRequestException('邮箱已被注册');
      }
    }

    if (createUserDto.phone) {
      const existingPhoneUser = await this.userRepository.findOne({
        where: { phone: createUserDto.phone },
      });
      if (existingPhoneUser) {
        throw new BadRequestException('手机号已被注册');
      }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // 创建新用户
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      verified: false, // 新用户默认未验证
    });

    return await this.userRepository.save(user);
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    // 尝试按邮箱查找
    let user = await this.userRepository.findOne({
      where: { email: identifier },
    });

    // 如果没找到，尝试按手机号查找
    if (!user) {
      user = await this.userRepository.findOne({
        where: { phone: identifier },
      });
    }

    return user;
  }

  async verifyUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.verified = true;
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      select: ['id', 'name', 'email', 'phone', 'role', 'verified', 'createdAt'],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }
}