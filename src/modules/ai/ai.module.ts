import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIService } from './ai.service';

@Module({
  imports: [HttpModule],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
