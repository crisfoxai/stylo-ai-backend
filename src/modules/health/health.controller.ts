import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks DB)' })
  ready() {
    const dbReady = this.connection.readyState === 1;
    return {
      status: dbReady ? 'ok' : 'not_ready',
      db: dbReady ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
