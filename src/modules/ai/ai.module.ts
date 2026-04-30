import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIService } from './ai.service';
import { AiUsageModule } from '../ai-usage/ai-usage.module';

@Module({
  imports: [HttpModule, AiUsageModule],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
