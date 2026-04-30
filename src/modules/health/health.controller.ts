import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { R2HealthIndicator } from './r2-health.indicator';
import { AiHealthIndicator } from './ai-health.indicator';

@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly r2: R2HealthIndicator,
    private readonly ai: AiHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe — process is alive' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — DB, Storage, AI' })
  readiness() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
      () => this.r2.isHealthy('r2-storage'),
      () => this.ai.isHealthy('ai-provider'),
    ]);
  }
}
