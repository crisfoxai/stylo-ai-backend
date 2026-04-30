import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { WardrobeItem, WardrobeItemDocument } from './schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';

const HAIKU_COST_PER_GARMENT_USD = 0.0003;

@Injectable()
export class WardrobeEnrichmentService {
  private readonly logger = new Logger(WardrobeEnrichmentService.name);

  constructor(
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
    private readonly aiService: AIService,
    private readonly r2Service: R2Service,
  ) {}

  @Cron('0 3 * * *')
  async runDailyEnrichment(): Promise<void> {
    this.logger.log('Starting daily wardrobe enrichment job');
    try {
      await this.enrichBatch({ batchSize: 50 });
    } catch (err) {
      this.logger.error(`Daily enrichment job failed: ${(err as Error).message}`);
    }
  }

  async enrichBatch(options: { userId?: string; batchSize?: number } = {}): Promise<{
    enrichedCount: number;
    totalToProcess: number;
    estimatedCostUSD: number;
  }> {
    const batchSize = options.batchSize ?? 50;

    const filter: Record<string, unknown> = {
      status: 'ready',
      archived: false,
      $or: [
        { occasions: { $exists: false } },
        { occasions: { $size: 0 } },
        { style: null },
        { style: '' },
        { style: { $exists: false } },
      ],
    };

    if (options.userId) {
      filter['userId'] = new Types.ObjectId(options.userId);
    }

    const totalToProcess = await this.itemModel.countDocuments(filter);
    const items = await this.itemModel
      .find(filter)
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .lean();

    let enrichedCount = 0;

    for (const item of items) {
      try {
        const imageUrl = await this.getImageUrl(item);
        if (!imageUrl) continue;

        const attrs = await this.aiService.enrichGarmentAttributes({
          imageUrl,
          category: item.category ?? '',
          name: item.name ?? '',
          color: item.color ?? '',
          userId: String(item.userId),
        });

        if (!attrs) continue;

        await this.itemModel.findByIdAndUpdate(item._id, {
          $set: {
            materials: attrs.materials,
            style: attrs.style,
            fit: attrs.fit,
            occasions: attrs.occasions,
            seasons: attrs.seasons,
          },
        });

        enrichedCount++;
      } catch (err) {
        this.logger.warn(`Failed to enrich garment ${String(item._id)}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Enrichment complete: ${enrichedCount}/${items.length} garments enriched (${totalToProcess} total pending)`);

    return {
      enrichedCount,
      totalToProcess,
      estimatedCostUSD: Math.round(enrichedCount * HAIKU_COST_PER_GARMENT_USD * 10000) / 10000,
    };
  }

  private async getImageUrl(item: { imageUrl?: string; imageProcessedUrl?: string }): Promise<string | null> {
    const url = item.imageProcessedUrl || item.imageUrl;
    if (!url) return null;

    // R2 private bucket keys need a signed URL; public CDN URLs can be used directly
    if (url.startsWith('http')) return url;

    try {
      return await this.r2Service.getSignedReadUrl(this.r2Service.bucketWardrobe(), url, 300);
    } catch {
      return null;
    }
  }
}
