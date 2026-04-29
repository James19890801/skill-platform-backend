import { IsEmail, IsString, IsPhoneNumber, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber('CN')
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsOptional()
  orgId?: number;
}