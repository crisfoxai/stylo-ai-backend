import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { TryonResult, TryonResultDocument } from './schemas/tryon-result.schema';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class TryonService {
  constructor(
    @InjectModel(TryonResult.name) private readonly tryonModel: Model<TryonResultDocument>,
    @InjectModel(WardrobeItem.name) private readonly wardrobeModel: Model<WardrobeItemDocument>,
    private readonly aiService: AIService,
    private readonly r2Service: R2Service,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async tryon(
    userId: string,
    userPhoto: Express.Multer.File,
    garmentId: string,
    outfitId?: string,
  ): Promise<TryonResultDocument> {
    // Rate limit check — throws 403 if over limit
    await this.subscriptionsService.checkAndIncrementUsage(userId, 'tryon');

    // Build cache key from photo hash + garmentId
    const photoHash = createHash('sha256').update(userPhoto.buffer).digest('hex');
    const cacheKey = createHash('sha256')
      .update(`${photoHash}:${garmentId}`)
      .digest('hex');

    // Cache hit — return existing result without calling Replicate
    const cached = await this.tryonModel.findOne({
      userId: new Types.ObjectId(userId),
      cacheKey,
    }).lean();
    if (cached) {
      return cached as TryonResultDocument;
    }

    // Upload user photo to R2
    const photoKey = `tryon/${userId}/${uuidv4()}.jpg`;
    const bucket = this.r2Service.bucketAvatars();
    const userPhotoUrl = await this.r2Service.uploadStream(
      bucket,
      photoKey,
      userPhoto.buffer,
      userPhoto.mimetype,
    );

    // Get garment image URL
    const garment = await this.wardrobeModel.findOne({
      _id: new Types.ObjectId(garmentId),
      userId: new Types.ObjectId(userId),
    }).lean();

    const garmentUrl = garment?.imageProcessedUrl ?? garment?.imageUrl ?? '';
    const garmentDescription = garment?.name || `${garment?.color ?? ''} ${garment?.category ?? ''}`.trim() || 'garment';

    // Call Replicate IDM-VTON
    let resultUrl: string;
    try {
      const result = await this.aiService.tryon(userPhotoUrl, [garmentUrl], garmentDescription);
      resultUrl = result.resultUrl;
    } catch {
      throw new ServiceUnavailableException({ error: 'TRYON_UNAVAILABLE' });
    }

    // Persist result with cacheKey
    return this.tryonModel.create({
      userId: new Types.ObjectId(userId),
      outfitId: outfitId ? new Types.ObjectId(outfitId) : undefined,
      garmentId: new Types.ObjectId(garmentId),
      cacheKey,
      resultUrl,
    });
  }
}
