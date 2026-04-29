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
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBody, ApiHeader } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { WardrobeEnrichmentService } from './wardrobe-enrichment.service';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers['x-admin-token'];
    const expected = this.configService.get<string>('ADMIN_TOKEN');
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
  constructor(
    private readonly enrichmentService: WardrobeEnrichmentService,
    private readonly configService: ConfigService,
  ) {}

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
