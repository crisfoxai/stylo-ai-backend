import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { WardrobeItem, WardrobeItemDocument } from './schemas/wardrobe-item.schema';
import { ListWardrobeDto, UpdateWardrobeItemDto } from './dto/wardrobe.dto';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class WardrobeService {
  constructor(
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
    private readonly aiService: AIService,
    private readonly r2Service: R2Service,
  ) {}

  async create(userId: string, file: Express.Multer.File): Promise<WardrobeItemDocument> {
    const key = `${userId}/${uuidv4()}-${file.originalname}`;
    const bucket = this.r2Service.bucketWardrobe();

    const imageUrl = await this.r2Service.uploadStream(
      bucket,
      key,
      Readable.from(file.buffer),
      file.mimetype,
    );

    const item = await this.itemModel.create({
      userId: new Types.ObjectId(userId),
      imageUrl,
      status: 'processing',
      tags: [],
    });

    this.runAIPipeline(String(item._id), imageUrl).catch(() => {
      // fire-and-forget, errors handled inside
    });

    return item;
  }

  private async runAIPipeline(itemId: string, imageUrl: string): Promise<void> {
    try {
      const [classifyResult, removeBgResult] = await Promise.all([
        this.aiService.classify(imageUrl),
        this.aiService.removeBg(imageUrl),
      ]);

      await this.itemModel.findByIdAndUpdate(itemId, {
        $set: {
          type: classifyResult.type,
          category: classifyResult.category,
          color: classifyResult.color,
          material: classifyResult.material,
          aiConfidence: classifyResult.confidence,
          imageProcessedUrl: removeBgResult.processedUrl,
          status: 'ready',
        },
      });
    } catch {
      await this.itemModel.findByIdAndUpdate(itemId, { $set: { status: 'failed' } });
    }
  }

  async list(userId: string, dto: ListWardrobeDto): Promise<{ items: WardrobeItemDocument[]; total: number; page: number }> {
    const filter: FilterQuery<WardrobeItem> = {
      userId: new Types.ObjectId(userId),
      archived: false,
    };

    if (dto.category) filter['category'] = dto.category;
    if (dto.color) filter['color'] = dto.color;
    if (dto.q) filter['$or'] = [
      { tags: { $regex: dto.q, $options: 'i' } },
      { brand: { $regex: dto.q, $options: 'i' } },
    ];

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.itemModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.itemModel.countDocuments(filter),
    ]);

    return { items: items as WardrobeItemDocument[], total, page };
  }

  async findOne(userId: string, itemId: string): Promise<WardrobeItemDocument> {
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(itemId),
      userId: new Types.ObjectId(userId),
      archived: false,
    }).lean();

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    return item as WardrobeItemDocument;
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdateWardrobeItemDto,
  ): Promise<WardrobeItemDocument> {
    const item = await this.itemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), userId: new Types.ObjectId(userId), archived: false },
      { $set: dto },
      { new: true },
    ).lean();

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    return item as WardrobeItemDocument;
  }

  async softDelete(userId: string, itemId: string): Promise<void> {
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(itemId),
      userId: new Types.ObjectId(userId),
    });

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    if (String(item.userId) !== userId) throw new ForbiddenException({ error: 'FORBIDDEN' });

    await this.itemModel.findByIdAndUpdate(itemId, { $set: { archived: true } });
  }
}
