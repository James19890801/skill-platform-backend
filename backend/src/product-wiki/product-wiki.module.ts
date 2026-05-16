import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ProductWikiController } from './product-wiki.controller';
import { ProductWikiService } from './product-wiki.service';

@Module({
  imports: [LlmModule],
  controllers: [ProductWikiController],
  providers: [ProductWikiService],
  exports: [ProductWikiService],
})
export class ProductWikiModule {}
