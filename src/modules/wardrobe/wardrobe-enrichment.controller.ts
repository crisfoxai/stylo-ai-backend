import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiHeader } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { WardrobeEnrichmentService } from './wardrobe-enrichment.service';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-admin-token'];
    const token = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
    const expected = (process.env['ADMIN_TOKEN'] ?? '').trim();
    if (!expected || token !== expected) {
      throw new UnauthorizedException({ error: 'INVALID_ADMIN_TOKEN' });
    }
    return true;
  }
}

class EnrichAttributesDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  batchSize?: number = 50;
}

@ApiTags('admin')
@Controller('admin/wardrobe')
export class WardrobeEnrichmentController {
  constructor(private readonly enrichmentService: WardrobeEnrichmentService) {}

  @Post('enrich-attributes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminTokenGuard)
  @ApiOperation({ summary: 'Trigger background enrichment of wardrobe attributes (admin)' })
  @ApiHeader({ name: 'x-admin-token', required: true, description: 'Admin secret token (ADMIN_TOKEN env var)' })
  @ApiBody({ type: EnrichAttributesDto })
  async enrich(@Body() dto: EnrichAttributesDto): Promise<{
    enrichedCount: number;
    totalToProcess: number;
    estimatedCostUSD: number;
  }> {
    return this.enrichmentService.enrichBatch({ userId: dto.userId, batchSize: dto.batchSize });
  }
}
