import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class LoginDto {
  @ApiProperty({ description: '邮箱或手机号' })
  @IsString()
  identifier: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  password: string;
}

@ApiTags('认证')
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.identifier, loginDto.password);
  }

  @Post('logout')
  @ApiOperation({ summary: '用户登出' })
  async logout() {
    return this.authService.logout();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }
}
