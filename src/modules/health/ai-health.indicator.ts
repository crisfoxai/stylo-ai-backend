import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { AIService } from '../ai/ai.service';

@Injectable()
export class AiHealthIndicator extends HealthIndicator {
  constructor(private readonly aiService: AIService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.aiService.ping();
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'AI provider check failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
