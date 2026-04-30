import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import sharp from 'sharp';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';

function assertObjectId(value: string, field = 'id'): void {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({ error: 'INVALID_ID', field });
  }
}
import { v4 as uuidv4 } from 'uuid';
import { WardrobeItem, WardrobeItemDocument } from './schemas/wardrobe-item.schema';
import { WardrobeJob, WardrobeJobDocument } from './schemas/wardrobe-job.schema';
import { ListWardrobeDto, UpdateWardrobeItemDto, ConfirmDetectionDto } from './dto/wardrobe.dto';
import { AIService, DetectedGarment } from '../ai/ai.service';
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

    this.runAIPipeline(String(item._id), jobId, imageUrl, userId).catch(() => {
      // fire-and-forget
    });

    return { jobId, status: 'processing' };
  }

  private async runAIPipeline(itemId: string, jobId: string, imageUrl: string, userId?: string): Promise<void> {
    try {
      const [classifyResult, removeBgResult] = await Promise.all([
        this.aiService.classify(imageUrl, userId),
        this.aiService.removeBg(imageUrl),
      ]);

      await this.itemModel.findByIdAndUpdate(itemId, {
        $set: {
          name: classifyResult.name || `${classifyResult.color} ${classifyResult.category}`,
          type: classifyResult.type,
          category: classifyResult.category,
          color: classifyResult.color,
          material: classifyResult.material,
          ...(classifyResult.materials?.length && { materials: classifyResult.materials }),
          ...(classifyResult.style && { style: classifyResult.style }),
          ...(classifyResult.fit && { fit: classifyResult.fit }),
          ...(classifyResult.occasions?.length && { occasions: classifyResult.occasions }),
          ...(classifyResult.seasons?.length && { seasons: classifyResult.seasons }),
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

  async countForUser(userId: string): Promise<number> {
    assertObjectId(userId, 'userId');
    return this.itemModel.countDocuments({
      userId: new Types.ObjectId(userId),
      archived: false,
    });
  }

  async list(userId: string, dto: ListWardrobeDto): Promise<{ items: (Record<string, unknown> & { id: string })[]; total: number; page: number }> {
    assertObjectId(userId, 'userId');
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
    assertObjectId(userId, 'userId');
    assertObjectId(itemId, 'itemId');
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
    assertObjectId(userId, 'userId');
    assertObjectId(itemId, 'itemId');
    const item = await this.itemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), userId: new Types.ObjectId(userId), archived: false },
      { $set: dto },
      { new: true },
    ).lean();

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    return this.toDto(item as Record<string, unknown>);
  }

  async softDelete(userId: string, itemId: string): Promise<void> {
    assertObjectId(userId, 'userId');
    assertObjectId(itemId, 'itemId');
    const item = await this.itemModel.findOne({
      _id: new Types.ObjectId(itemId),
      userId: new Types.ObjectId(userId),
    });

    if (!item) throw new NotFoundException({ error: 'NOT_FOUND' });
    if (String(item.userId) !== userId) throw new ForbiddenException({ error: 'FORBIDDEN' });

    await this.itemModel.findByIdAndUpdate(itemId, { $set: { archived: true } });
  }

  async detectFromPhoto(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<{ detected: DetectedGarment[]; photoKey: string }> {
    const bucket = this.r2Service.bucketWardrobe();
    const photoKey = `wardrobe/detections/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    await this.r2Service.uploadStream(bucket, photoKey, file.buffer, file.mimetype, {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const detected = await this.aiService.detectGarments(file.buffer, file.mimetype, userId);

    if (detected.length === 0) {
      throw new UnprocessableEntityException({ error: 'NO_GARMENTS_DETECTED' });
    }

    return { detected, photoKey };
  }

  async confirmDetection(
    userId: string,
    dto: ConfirmDetectionDto,
  ): Promise<{ created: number; garmentIds: string[] }> {
    assertObjectId(userId, 'userId');

    const bucket = this.r2Service.bucketWardrobe();
    // Download original photo from R2 via signed URL then fetch
    const signedUrl = await this.r2Service.getSignedReadUrl(bucket, dto.photoKey, 300);
    let originalBuffer: Buffer;
    try {
      const res = await fetch(signedUrl);
      originalBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      throw new BadRequestException({ error: 'PHOTO_NOT_FOUND' });
    }

    const meta = await sharp(originalBuffer).metadata();
    const imgH = meta.height ?? 800;
    const imgW = meta.width ?? 600;

    const garmentIds: string[] = [];

    for (const g of dto.garments) {
      // Crop by category
      const cropRegion = this.getCropRegion(g.categoria, imgW, imgH);
      let croppedBuffer = await sharp(originalBuffer)
        .extract(cropRegion)
        .jpeg({ quality: 90 })
        .toBuffer();

      // Remove background via Replicate (reuse existing pipeline)
      let processedUrl: string | undefined;
      try {
        const tempKey = `wardrobe/${userId}/detection-temp-${Date.now()}.jpg`;
        const tempUrl = await this.r2Service.uploadStream(bucket, tempKey, croppedBuffer, 'image/jpeg');
        const removeBgResult = await this.aiService.removeBg(tempUrl);
        processedUrl = removeBgResult.processedUrl;
        await this.r2Service.deleteObject(bucket, tempKey).catch(() => {});
      } catch {
        // proceed without bg removal
      }

      const item = await this.itemModel.create({
        userId: new Types.ObjectId(userId),
        imageUrl: processedUrl ?? '',
        imageProcessedUrl: processedUrl,
        name: g.descripcion,
        type: g.tipo,
        category: g.categoria,
        color: g.color,
        ...(g.material && { material: g.material }),
        ...(g.materials?.length && { materials: g.materials }),
        ...(g.style && { style: g.style }),
        ...(g.fit && { fit: g.fit }),
        ...(g.seasons?.length && { seasons: g.seasons }),
        ...(g.occasions?.length && { occasions: g.occasions }),
        aiConfidence: 0.9,
        status: processedUrl ? 'ready' : 'processing',
        tags: [],
      });

      garmentIds.push(String(item._id));
    }

    return { created: garmentIds.length, garmentIds };
  }

  private getCropRegion(
    categoria: string,
    w: number,
    h: number,
  ): { left: number; top: number; width: number; height: number } {
    switch (categoria) {
      case 'top':
        return { left: 0, top: 0, width: w, height: Math.floor(h * 0.5) };
      case 'bottom':
        return { left: 0, top: Math.floor(h * 0.4), width: w, height: Math.floor(h * 0.6) };
      case 'footwear':
        return { left: 0, top: Math.floor(h * 0.65), width: w, height: Math.floor(h * 0.35) };
      default:
        return { left: 0, top: 0, width: w, height: h };
    }
  }
}
