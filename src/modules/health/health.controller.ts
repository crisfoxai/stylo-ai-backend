import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks DB + Redis)' })
  async ready() {
    const dbReady = this.connection.readyState === 1;
    const redisReady = await this.redisService.ping();
    const ok = dbReady && redisReady;
    return {
      status: ok ? 'ok' : 'not_ready',
      db: dbReady ? 'connected' : 'disconnected',
      redis: redisReady ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
