import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common';
import { TenantService, CreateTenantDto } from './tenant.service';

@ApiTags('租户管理')
@Controller('api/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: '获取租户列表' })
  async findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: '获取租户详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建租户' })
  async create(@Body() body: CreateTenantDto) {
    return this.tenantService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: '更新租户' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      code?: string;
      logo?: string;
      contactEmail?: string;
      contactPhone?: string;
      status?: string;
      plan?: string;
      dingtalkCorpId?: string;
      dingtalkAppKey?: string;
      dingtalkAppSecret?: string;
      wecomCorpId?: string;
      wecomSecret?: string;
      settings?: string;
    },
  ) {
    return this.tenantService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: '删除租户' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.remove(id);
  }
}
