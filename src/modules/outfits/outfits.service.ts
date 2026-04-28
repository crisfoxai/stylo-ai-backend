import { Injectable, NotFoundException, BadRequestException, UnsupportedMediaTypeException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import sharp from 'sharp';
import { Outfit, OutfitDocument } from './schemas/outfit.schema';
import { FavoriteOutfit, FavoriteOutfitDocument } from './schemas/favorite-outfit.schema';
import { WornEntry, WornEntryDocument } from './schemas/worn-entry.schema';
import { GenerateOutfitDto, OutfitHistoryDto, ListOutfitsDto } from './dto/outfit.dto';
import { SwapGarmentDto, GarmentSlot } from './dto/swap-garment.dto';
import { OutfitsGenerator, OutfitGarment } from './outfits.generator';
import { WeatherService } from '../weather/weather.service';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';

function assertObjectId(value: string, field = 'id'): void {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({ error: 'INVALID_ID', field });
  }
}

@Injectable()
export class OutfitsService {
  constructor(
    @InjectModel(Outfit.name) private readonly outfitModel: Model<OutfitDocument>,
    @InjectModel(FavoriteOutfit.name) private readonly favoriteModel: Model<FavoriteOutfitDocument>,
    @InjectModel(WornEntry.name) private readonly wornModel: Model<WornEntryDocument>,
    @InjectModel(WardrobeItem.name) private readonly wardrobeItemModel: Model<WardrobeItemDocument>,
    private readonly generator: OutfitsGenerator,
    private readonly weatherService: WeatherService,
    private readonly usersService: UsersService,
    private readonly r2Service: R2Service,
    private readonly redisService: RedisService,
  ) {}

  // POST /outfits/generate — generates outfit preview and stores in Redis (no Mongo persistence)
  async generate(userId: string, dto: GenerateOutfitDto): Promise<{
    preview: { previewId: string; garments: OutfitGarment[]; justification: string; expiresAt: string };
  }> {
    assertObjectId(userId, 'userId');
    const weather =
      dto.lat !== undefined && dto.lon !== undefined
        ? await this.weatherService.getByLocation(dto.lat, dto.lon)
        : undefined;

    const styleProfile = await this.usersService.getStyleProfile(userId);
    const composition = await this.generator.compose(
      userId,
      dto.occasion,
      dto.mood,
      weather,
      styleProfile,
      dto.excludeIds,
      dto,
    );

    const previewId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const previewData = {
      previewId,
      userId,
      garments: composition.garments,
      justification: composition.justification,
      occasion: dto.occasion,
      mood: dto.mood,
      weatherContext: dto.weatherContext ?? weather,
      items: composition.items,
      aiModel: composition.aiModel,
      contextFactors: composition.contextFactors,
      expiresAt,
    };

    await this.redisService.set(`outfit_preview:${userId}`, JSON.stringify(previewData), 1800);

    return {
      preview: {
        previewId,
        garments: composition.garments,
        justification: composition.justification,
        expiresAt,
      },
    };
  }

  // GET /outfits/preview — recovery: get current preview from Redis
  async getPreview(userId: string): Promise<{
    preview: { previewId: string; garments: OutfitGarment[]; justification: string; expiresAt: string };
  } | null> {
    const raw = await this.redisService.get(`outfit_preview:${userId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      previewId: string;
      garments: OutfitGarment[];
      justification: string;
      expiresAt: string;
    };
    return {
      preview: {
        previewId: data.previewId,
        garments: data.garments,
        justification: data.justification,
        expiresAt: data.expiresAt,
      },
    };
  }

  // POST /outfits — persist from preview stored in Redis
  async persistPreview(userId: string): Promise<{ outfit: Record<string, unknown> }> {
    assertObjectId(userId, 'userId');
    const raw = await this.redisService.get(`outfit_preview:${userId}`);
    if (!raw) {
      throw new BadRequestException({ error: 'preview_expired', message: 'El preview expiró. Generá uno nuevo.' });
    }

    const data = JSON.parse(raw) as {
      previewId: string;
      userId: string;
      garments: OutfitGarment[];
      justification: string;
      occasion?: string;
      mood?: string;
      weatherContext?: unknown;
      items: { wardrobeItemId: Types.ObjectId; slot: string }[];
      aiModel: string;
      contextFactors: string[];
      expiresAt: string;
    };

    const outfitDoc = await this.outfitModel.create({
      userId: new Types.ObjectId(userId),
      occasion: data.occasion,
      mood: data.mood,
      weatherContext: data.weatherContext,
      items: data.items,
      aiModel: data.aiModel,
      justification: data.justification,
      contextFactors: data.contextFactors,
    });

    await this.redisService.del(`outfit_preview:${userId}`);

    return {
      outfit: {
        id: String(outfitDoc._id),
        name: 'Outfit generado',
        occasion: outfitDoc.occasion,
        mood: outfitDoc.mood,
        garments: data.garments,
        justification: outfitDoc.justification,
        contextFactors: outfitDoc.contextFactors,
        createdAt: outfitDoc.createdAt,
      },
    };
  }

  async addFavorite(userId: string, outfitId: string): Promise<void> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    await this.favoriteModel.updateOne(
      { userId: new Types.ObjectId(userId), outfitId: new Types.ObjectId(outfitId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), outfitId: new Types.ObjectId(outfitId) } },
      { upsert: true },
    );
  }

  async removeFavorite(userId: string, outfitId: string): Promise<void> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    await this.favoriteModel.deleteOne({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
  }

  async getFavorites(userId: string): Promise<FavoriteOutfitDocument[]> {
    assertObjectId(userId, 'userId');
    return this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('outfitId')
      .lean() as unknown as FavoriteOutfitDocument[];
  }

  async markWorn(userId: string, outfitId: string): Promise<WornEntryDocument> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    const outfit = await this.outfitModel.findOne({
      _id: new Types.ObjectId(outfitId),
      userId: new Types.ObjectId(userId),
    });
    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    return this.wornModel.create({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
      wornDate: new Date(),
    });
  }

  private resolveCoverImageUrl(outfit: Record<string, unknown>): string {
    if (outfit['tryonImageUrl']) return outfit['tryonImageUrl'] as string;
    if (outfit['lookPhotoUrl']) return outfit['lookPhotoUrl'] as string;
    if (outfit['collageImageUrl']) return outfit['collageImageUrl'] as string;
    return '';
  }

  async findOne(userId: string, outfitId: string): Promise<Record<string, unknown>> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    const [outfit, favorite] = await Promise.all([
      this.outfitModel.findOne({
        _id: new Types.ObjectId(outfitId),
        userId: new Types.ObjectId(userId),
      }).lean(),
      this.favoriteModel.findOne({
        userId: new Types.ObjectId(userId),
        outfitId: new Types.ObjectId(outfitId),
      }).lean(),
    ]);

    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    const garments = await this.generator.populateGarments(outfit.items as { wardrobeItemId: Types.ObjectId; slot: string }[]);
    const lastWorn = await this.wornModel.findOne({ userId: new Types.ObjectId(userId), outfitId: new Types.ObjectId(outfitId) }).sort({ wornDate: -1 }).lean();

    return {
      ...outfit,
      id: String(outfit._id),
      name: 'Outfit',
      garments,
      coverImageUrl: this.resolveCoverImageUrl(outfit as Record<string, unknown>),
      coverImageSource: (outfit as Record<string, unknown>)['coverImageSource'] ?? 'placeholder',
      tryonImageUrl: (outfit as Record<string, unknown>)['tryonImageUrl'] ?? null,
      lookPhotoUrl: (outfit as Record<string, unknown>)['lookPhotoUrl'] ?? null,
      isFavorite: !!favorite,
      hasLookPhoto: !!(outfit as Record<string, unknown>)['lookPhotoUrl'],
      usedAt: lastWorn ? (lastWorn as Record<string, unknown>)['wornDate'] : null,
    };
  }

  async listByUser(userId: string, dto: ListOutfitsDto): Promise<{ data: Record<string, unknown>[]; total: number; page: number; totalPages: number }> {
    assertObjectId(userId, 'userId');
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(50, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Outfit> = { userId: new Types.ObjectId(userId) };
    if (dto.occasion) filter['occasion'] = dto.occasion;
    if (dto.hasLookPhoto) filter['lookPhotoUrl'] = { $ne: null };

    // favorites filter
    let favoriteOutfitIds: Types.ObjectId[] | undefined;
    if (dto.favorites) {
      const favs = await this.favoriteModel.find({ userId: new Types.ObjectId(userId) }).lean();
      favoriteOutfitIds = favs.map((f) => (f as Record<string, unknown>)['outfitId'] as Types.ObjectId);
      filter['_id'] = { $in: favoriteOutfitIds };
    }

    const sortDir = dto.sort === 'oldest' ? 1 : -1;

    const [outfits, total, favorites] = await Promise.all([
      this.outfitModel.find(filter).sort({ createdAt: sortDir }).skip(skip).limit(limit).lean(),
      this.outfitModel.countDocuments(filter),
      this.favoriteModel.find({ userId: new Types.ObjectId(userId) }).lean(),
    ]);

    const favoriteSet = new Set(favorites.map((f) => String((f as Record<string, unknown>)['outfitId'])));

    const data = outfits.map((o) => ({
      id: String(o._id),
      name: 'Outfit',
      occasion: o.occasion,
      coverImageUrl: this.resolveCoverImageUrl(o as Record<string, unknown>),
      coverImageSource: (o as Record<string, unknown>)['coverImageSource'] ?? 'placeholder',
      isFavorite: favoriteSet.has(String(o._id)),
      hasLookPhoto: !!(o as Record<string, unknown>)['lookPhotoUrl'],
      contextFactors: o.contextFactors ?? [],
      justification: o.justification ?? '',
      createdAt: (o as Record<string, unknown>)['createdAt'] ?? null,
      usedAt: null,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getHistory(userId: string, dto: OutfitHistoryDto): Promise<WornEntryDocument[]> {
    assertObjectId(userId, 'userId');
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

    if (dto.month) {
      const [year, month] = dto.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      filter['wornDate'] = { $gte: start, $lt: end };
    }

    return this.wornModel.find(filter).sort({ wornDate: -1 }).lean() as unknown as WornEntryDocument[];
  }

  async uploadLookPhoto(userId: string, outfitId: string, file: Express.Multer.File): Promise<{ lookPhotoUrl: string; coverImageSource: string }> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');

    if (file.size > 10 * 1024 * 1024) throw new PayloadTooLargeException({ error: 'FILE_TOO_LARGE' });
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException({ error: 'UNSUPPORTED_FORMAT' });
    }

    const outfit = await this.outfitModel.findOne({ _id: new Types.ObjectId(outfitId), userId: new Types.ObjectId(userId) }).lean();
    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    let buffer = file.buffer;
    if (buffer.length > 4 * 1024 * 1024) {
      buffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
    }

    const bucket = this.r2Service.bucketWardrobe();

    if ((outfit as Record<string, unknown>)['lookPhotoUrl']) {
      const oldUrl = (outfit as Record<string, unknown>)['lookPhotoUrl'] as string;
      const oldKey = oldUrl.split('/').slice(-2).join('/');
      await this.r2Service.deleteObject(bucket, oldKey).catch(() => {});
    }

    const key = `outfits/${outfitId}/look-photo.jpg`;
    await this.r2Service.uploadStream(bucket, key, buffer, 'image/jpeg');
    const url = this.r2Service.getPublicUrl(bucket, key);

    await this.outfitModel.updateOne(
      { _id: new Types.ObjectId(outfitId) },
      { $set: { lookPhotoUrl: url, coverImageSource: 'user_look' } },
    );

    return { lookPhotoUrl: url, coverImageSource: 'user_look' };
  }

  async deleteLookPhoto(userId: string, outfitId: string): Promise<{ coverImageSource: string }> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');

    const outfit = await this.outfitModel.findOne({ _id: new Types.ObjectId(outfitId), userId: new Types.ObjectId(userId) }).lean();
    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    const bucket = this.r2Service.bucketWardrobe();
    const lookPhotoUrl = (outfit as Record<string, unknown>)['lookPhotoUrl'] as string | null;
    if (lookPhotoUrl) {
      const key = lookPhotoUrl.split('/').slice(-2).join('/');
      await this.r2Service.deleteObject(bucket, key).catch(() => {});
    }

    const tryonImageUrl = (outfit as Record<string, unknown>)['tryonImageUrl'] as string | null;
    const newSource = tryonImageUrl ? 'tryon' : 'placeholder';

    await this.outfitModel.updateOne(
      { _id: new Types.ObjectId(outfitId) },
      { $set: { lookPhotoUrl: null, coverImageSource: newSource } },
    );

    return { coverImageSource: newSource };
  }

  async swapGarment(
    userId: string,
    outfitId: string,
    dto: SwapGarmentDto,
  ): Promise<{ garment: OutfitGarment | null }> {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');

    const outfit = await this.outfitModel
      .findOne({ _id: new Types.ObjectId(outfitId), userId: new Types.ObjectId(userId) })
      .lean();
    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    // Determine which wardrobe item is currently in this slot
    const currentItem = outfit.items.find((i) => i.slot === dto.garmentSlot);
    const currentItemId = currentItem ? String(currentItem.wardrobeItemId) : null;

    // Build type filter — 'dress' is also valid for 'top' slot
    const typeFilter: string[] = [dto.garmentSlot as string];
    if ((dto.garmentSlot as GarmentSlot) === 'top') typeFilter.push('dress');

    const excludeSet = new Set<string>(dto.excludeIds ?? []);
    if (currentItemId) excludeSet.add(currentItemId);

    const candidates = await this.wardrobeItemModel
      .find({
        userId: new Types.ObjectId(userId),
        type: { $in: typeFilter },
        status: 'ready',
        archived: false,
        ...(excludeSet.size > 0 && {
          _id: { $nin: [...excludeSet].map((id) => new Types.ObjectId(id)) },
        }),
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!candidates.length) return { garment: null };

    // Pick the first candidate (fallback — Gemini scoring can be added later)
    const picked = candidates[0];
    return {
      garment: {
        garmentId: String(picked._id),
        thumbnailUrl: picked.imageProcessedUrl || picked.imageUrl || '',
        type: picked.type || '',
        color: picked.color || '',
        style: dto.garmentSlot,
      },
    };
  }
}
