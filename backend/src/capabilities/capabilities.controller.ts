import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CapabilitiesService } from './capabilities.service';
import { CreateCapabilityTreeDto, UpdateCapabilityTreeDto } from './dto';

@ApiTags('能力树')
@Controller('api/capability-trees')
export class CapabilitiesController {
  constructor(private readonly capabilitiesService: CapabilitiesService) {}

  @Get()
  @ApiOperation({ summary: '获取能力树列表' })
  findAll() {
    return this.capabilitiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取能力树详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.capabilitiesService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建能力树' })
  create(@Body() dto: CreateCapabilityTreeDto, @Request() req: any) {
    return this.capabilitiesService.create(dto, req.user.id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新能力树' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCapabilityTreeDto,
    @Request() req: any,
  ) {
    return this.capabilitiesService.update(id, dto, req.user.id, req.user.isAdmin);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除能力树' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.capabilitiesService.remove(id, req.user.id, req.user.isAdmin);
  }
}
