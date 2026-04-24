import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { TryonResult, TryonResultDocument } from './schemas/tryon-result.schema';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class TryonService {
  constructor(
    @InjectModel(TryonResult.name) private readonly tryonModel: Model<TryonResultDocument>,
    @InjectModel(WardrobeItem.name) private readonly wardrobeModel: Model<WardrobeItemDocument>,
    private readonly aiService: AIService,
    private readonly r2Service: R2Service,
  ) {}

  async tryon(
    userId: string,
    userPhoto: Express.Multer.File,
    outfitId: string | undefined,
    itemIds: string[],
    isPremium: boolean,
  ): Promise<TryonResultDocument> {
    if (!isPremium) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const count = await this.tryonModel.countDocuments({
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: monthStart },
      });
      if (count >= 3) {
        throw new ForbiddenException({ error: 'PLAN_LIMIT', limit: { monthly: 3, used: count } });
      }
    }

    const bucket = this.r2Service.bucketAvatars();
    const photoKey = `tryon/${userId}/${uuidv4()}.jpg`;
    const userPhotoUrl = await this.r2Service.uploadStream(
      bucket,
      photoKey,
      Readable.from(userPhoto.buffer),
      userPhoto.mimetype,
    );

    const ids = itemIds.length > 0 ? itemIds : [];
    const items = await this.wardrobeModel.find({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      userId: new Types.ObjectId(userId),
    }).lean();

    const itemUrls = items
      .map((i) => i.imageProcessedUrl ?? i.imageUrl)
      .filter(Boolean);

    const { resultUrl } = await this.aiService.tryon(userPhotoUrl, itemUrls);

    return this.tryonModel.create({
      userId: new Types.ObjectId(userId),
      outfitId: outfitId ? new Types.ObjectId(outfitId) : undefined,
      resultUrl,
    });
  }
}
