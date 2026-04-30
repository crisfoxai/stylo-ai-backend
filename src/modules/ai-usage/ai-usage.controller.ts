import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AiUsageService } from './ai-usage.service';
import { AdminTokenGuard } from '../wardrobe/wardrobe-enrichment.controller';

@ApiTags('admin')
@Controller('admin/ai-costs')
@UseGuards(AdminTokenGuard)
export class AiUsageController {
  constructor(private readonly aiUsageService: AiUsageService) {}

  @Get()
  @ApiOperation({ summary: 'Get aggregated AI costs for a date range (admin)' })
  @ApiHeader({ name: 'x-admin-token', required: true })
  @ApiQuery({ name: 'from', required: true, description: 'ISO date start (e.g. 2026-04-01)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date end (defaults to now)' })
  async getCosts(
    @Query('from') fromStr: string,
    @Query('to') toStr?: string,
  ) {
    if (!fromStr) throw new BadRequestException({ error: 'MISSING_FROM_DATE' });
    const from = new Date(fromStr);
    if (isNaN(from.getTime())) throw new BadRequestException({ error: 'INVALID_FROM_DATE' });
    const to = toStr ? new Date(toStr) : new Date();
    if (isNaN(to.getTime())) throw new BadRequestException({ error: 'INVALID_TO_DATE' });
    return this.aiUsageService.getAggregatedCosts(from, to);
  }
}
