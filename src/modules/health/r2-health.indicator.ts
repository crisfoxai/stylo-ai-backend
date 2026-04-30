import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class R2HealthIndicator extends HealthIndicator {
  constructor(private readonly r2: R2Service) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.r2.ping();
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'R2 storage check failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
