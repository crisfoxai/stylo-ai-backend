import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { R2HealthIndicator } from './r2-health.indicator';
import { AiHealthIndicator } from './ai-health.indicator';
import { StorageModule } from '../storage/storage.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [TerminusModule, MongooseModule, StorageModule, AIModule],
  controllers: [HealthController],
  providers: [R2HealthIndicator, AiHealthIndicator],
})
export class HealthModule {}
