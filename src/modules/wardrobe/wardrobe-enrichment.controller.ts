import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { WardrobeEnrichmentService } from './wardrobe-enrichment.service';

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
  @ApiOperation({ summary: 'Trigger background enrichment of wardrobe attributes (admin)' })
  @ApiBody({ type: EnrichAttributesDto })
  async enrich(@Body() dto: EnrichAttributesDto): Promise<{
    enrichedCount: number;
    totalToProcess: number;
    estimatedCostUSD: number;
  }> {
    return this.enrichmentService.enrichBatch({ userId: dto.userId, batchSize: dto.batchSize });
  }
}
