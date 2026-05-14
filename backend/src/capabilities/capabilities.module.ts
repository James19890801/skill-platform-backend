import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapabilityEdge, CapabilityNode, CapabilityTree } from '../entities';
import { CapabilitiesController } from './capabilities.controller';
import { CapabilitiesService } from './capabilities.service';

@Module({
  imports: [TypeOrmModule.forFeature([CapabilityTree, CapabilityNode, CapabilityEdge])],
  controllers: [CapabilitiesController],
  providers: [CapabilitiesService],
  exports: [CapabilitiesService],
})
export class CapabilitiesModule {}
