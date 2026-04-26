import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WardrobeItem, WardrobeItemDocument } from './schemas/wardrobe-item.schema';
import { WardrobeJob, WardrobeJobDocument } from './schemas/wardrobe-job.schema';
import { ListWardrobeDto, UpdateWardrobeItemDto } from './dto/wardrobe.dto';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class WardrobeService {
  constructor(
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
    @InjectModel(WardrobeJob.name) private readonly jobModel: Model<WardrobeJobDocument>,
    private readonly aiService: AIService,
    private readonly r2Service: R2Service,
  ) {}

  async create(userId: string, file: Express.Multer.File): Promise<{ jobId: string; status: string }> {
    const jobId = uuidv4();
    const key = `${userId}/${jobId}-${file.originalname}`;
    const bucket = this.r2Service.bucketWardrobe();

    const imageUrl = await this.r2Service.uploadStream(
      bucket,
      key,
      file.buffer,
      file.mimetype,
    );

    const [item] = await Promise.all([
      this.itemModel.create({
        userId: new Types.ObjectId(userId),
        imageUrl,
        status: 'processing',
        tags: [],
      }),
      this.jobModel.create({
        jobId,
        userId: new Types.ObjectId(userId),
        status: 'processing',
      }),
    ]);

    this.runAIPipeline(String(item._id), jobId, imageUrl).catch(() => {
      // fire-and-forget
    });

    return { jobId, status: 'processing' };
  }

  private async runAIPipeline(itemId: string, jobId: string, imageUrl: string): Promise<void> {
    try {
      const [classifyResult, removeBgResult] = await Promise.all([
        this.aiService.classify(imageUrl),
        this.aiService.removeBg(imageUrl),
      ]);

      await this.itemModel.findByIdAndUpdate(itemId, {
        $set: {
          name: classifyResult.name || `${classifyResult.color} ${classifyResult.category}`,
          type: classifyResult.type,
          category: classifyResult.category,
          color: classifyResult.color,
          material: classifyResult.material,
          aiConfidence: classifyResult.confidence,
          imageProcessedUrl: removeBgResult.processedUrl,
          status: 'ready',
        },
      });

      await this.jobModel.findOneAndUpdate(
        { jobId },
        { $set: { status: 'done', garmentId: new Types.ObjectId(itemId) } },
      );
    } catch (err) {
      await this.itemModel.findByIdAndUpdate(itemId, { $set: { status: 'failed' } });
      await this.jobModel.findOneAndUpdate(
        { jobId },
        { $set: { status: 'failed', error: (err as Error).message } },
      );
    }
  }

  async getJob(userId: string, jobId: string): Promise<{ jobId: string; status: string; garmentId?: string }> {
    const job = await this.jobModel.findOne({
      jobId,
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!job) throw new NotFoundException({ error: 'JOB_NOT_FOUND' });

    return {
      jobId: job.jobId,
      status: job.status,
      ...(job.garmentId ? { garmentId: job.garmentId.toString() } : {}),
    };
  }

  private toDto(item: Record<string, unknown>): Record<string, unknown> & { id: string } {
    const { _id, __v, ...rest } = item;
    return { id: String(_id), ...rest };
  }

  async list(userId: string, dto: ListWardrobeDto): Promise<{ items: (Record<string, unknown> & { id: string })[]; total: number; page: number }> {
    const filter: FilterQuery<WardrobeItem> = {
      userId: new Types.ObjectId(userId),
      archived: false,
    };

    if (dto.type) filter['type'] = dto.type;
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

    return { items: items.map((i) => this.toDto(i as Record<string, unknown>)), total, page };
  }

  async findOne(userId: string, itemId: string): Promise<Record<string, unknown> & { id: string }> {
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(itemId),
      userId: new Types.ObjectId(userId),
      archived: false,
    }).lean();

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    return this.toDto(item as Record<string, unknown>);
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdateWardrobeItemDto,
  ): Promise<Record<string, unknown> & { id: string }> {
    const item = await this.itemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), userId: new Types.ObjectId(userId), archived: false },
      { $set: dto },
      { new: true },
    ).lean();

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    return this.toDto(item as Record<string, unknown>);
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
