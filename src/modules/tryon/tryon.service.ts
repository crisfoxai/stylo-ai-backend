import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { TryonResult, TryonResultDocument } from './schemas/tryon-result.schema';
import { TryOnBasePhoto, TryOnBasePhotoDocument } from './schemas/tryon-base-photo.schema';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TryonOutfitGarmentDto } from './dto/tryon.dto';

const BASE_PHOTOS_LIMIT = 20;

const CATEGORY_MAP: Record<string, string> = {
  // Canonical
  top: 'upper_body',
  bottom: 'lower_body',
  outerwear: 'upper_body',
  dress: 'dresses',
  // Aliases — lower body
  pants: 'lower_body',
  pant: 'lower_body',
  jeans: 'lower_body',
  trousers: 'lower_body',
  shorts: 'lower_body',
  skirt: 'lower_body',
  // Aliases — upper body
  shirt: 'upper_body',
  tshirt: 'upper_body',
  blouse: 'upper_body',
  sweater: 'upper_body',
  hoodie: 'upper_body',
  jacket: 'upper_body',
  coat: 'upper_body',
};

const TYPE_EN: Record<string, string> = {
  pantalon: 'trousers',
  remera: 'shirt',
  vestido: 'dress',
  campera: 'jacket',
  saco: 'blazer',
  falda: 'skirt',
  zapatilla: 'sneakers',
  zapato: 'shoes',
  short: 'shorts',
  bermuda: 'shorts',
  pollera: 'skirt',
  buzo: 'sweatshirt',
  camiseta: 'shirt',
  chomba: 'polo shirt',
  tapado: 'coat',
  abrigo: 'coat',
};

function mapCategoryToVton(mongoCategory: string): string {
  const key = (mongoCategory ?? '').toLowerCase().replace(/[-_\s]/g, '');
  const mapped = CATEGORY_MAP[key];
  if (!mapped) {
    throw new BadRequestException(
      `Try-on not available for category: ${mongoCategory}. Supported: top, bottom, outerwear, dress (and common aliases).`,
    );
  }
  return mapped;
}

function buildGarmentDes(garment: {
  color?: string;
  fit?: string | null;
  type?: string;
  name?: string;
  category?: string;
}): string {
  const parts: string[] = [];
  if (garment.color) parts.push(garment.color);
  if (garment.fit) parts.push(garment.fit);
  const rawType = garment.type?.toLowerCase() ?? '';
  const typeEn = (TYPE_EN[rawType] ?? rawType) || garment.name || garment.category || 'garment';
  parts.push(typeEn);
  return parts.join(' ');
}

@Injectable()
export class TryonService {
  private readonly logger = new Logger(TryonService.name);

  constructor(
    @InjectModel(TryonResult.name) private readonly tryonModel: Model<TryonResultDocument>,
    @InjectModel(TryOnBasePhoto.name) private readonly basePhotoModel: Model<TryOnBasePhotoDocument>,
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
    this.logger.log(`[tryon] userId=${userId} garmentId=${garmentId}`);

    await this.subscriptionsService.checkAndIncrementUsage(userId, 'tryon');

    const photoHash = createHash('sha256').update(userPhoto.buffer).digest('hex');
    const cacheKey = `${photoHash}:${garmentId}`;

    const cached = await this.tryonModel.findOne({
      userId: new Types.ObjectId(userId),
      cacheKey,
    }).lean();
    if (cached) {
      this.logger.log(`[tryon] Cache hit for userId=${userId} garmentId=${garmentId}`);
      return cached as TryonResultDocument;
    }

    const photoKey = `tryon/${userId}/${uuidv4()}.jpg`;
    const bucket = this.r2Service.bucketAvatars();
    const userPhotoUrl = await this.r2Service.uploadStream(
      bucket,
      photoKey,
      userPhoto.buffer,
      userPhoto.mimetype,
    );

    const garment = await this.wardrobeModel.findOne({
      _id: new Types.ObjectId(garmentId),
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!garment) throw new NotFoundException({ error: 'GARMENT_NOT_FOUND' });

    if (['footwear', 'accessory'].includes(garment.category)) {
      throw new BadRequestException(
        'El try-on de calzado y accesorios no está disponible aún. Próximamente.',
      );
    }

    const vtonCategory = mapCategoryToVton(garment.category);
    const garmentDes = buildGarmentDes(garment);
    const garmentUrl = garment.imageProcessedUrl ?? garment.imageUrl;

    this.logger.log(`[tryon] garmentDes="${garmentDes}" vtonCategory="${vtonCategory}" garmentUrl=${garmentUrl}`);

    let resultUrl: string;
    try {
      const result = await this.aiService.tryon(userPhotoUrl, [garmentUrl], garmentDes, vtonCategory);
      resultUrl = result.resultUrl;
      this.logger.log(`[tryon] Success resultUrl=${resultUrl}`);
    } catch (err) {
      this.logger.error(`[tryon] Failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('El try-on falló. Intentá de nuevo.');
    }

    return this.tryonModel.create({
      userId: new Types.ObjectId(userId),
      outfitId: outfitId ? new Types.ObjectId(outfitId) : undefined,
      garmentId: new Types.ObjectId(garmentId),
      cacheKey,
      resultUrl,
    });
  }

  async tryonOutfit(
    userId: string,
    userPhoto: Express.Multer.File | null,
    garments: TryonOutfitGarmentDto[],
    outfitId?: string,
    basePhotoId?: string,
  ): Promise<{ resultImageUrl: string; creditsUsed: number }> {
    // Exactly one of userPhoto or basePhotoId must be provided
    if (!userPhoto && !basePhotoId) {
      throw new BadRequestException({ error: 'MISSING_PHOTO', message: 'Provide either basePhotoFile or basePhotoId.' });
    }
    if (userPhoto && basePhotoId) {
      throw new BadRequestException({ error: 'AMBIGUOUS_PHOTO', message: 'Provide only one of basePhotoFile or basePhotoId.' });
    }
    this.logger.log(`[tryon/outfit] userId=${userId} garments=${JSON.stringify(garments)}`);

    if (!garments?.length) {
      throw new BadRequestException('Debés seleccionar al menos una prenda.');
    }

    for (const g of garments) {
      const normalized = (g.category ?? '').toLowerCase().replace(/[-_\s]/g, '');
      if (!CATEGORY_MAP[normalized]) {
        throw new BadRequestException(
          `Categoría no soportada para try-on: ${g.category}. Soportadas: top, bottom, outerwear, dress (y aliases comunes).`,
        );
      }
    }

    const creditsNeeded = garments.length;
    const tryonStats = await this.subscriptionsService.getTryonStats(userId);
    const remaining = tryonStats.tryonsLimitThisMonth !== null
      ? tryonStats.tryonsLimitThisMonth - tryonStats.tryonsUsedThisMonth
      : Infinity;

    if (remaining < creditsNeeded) {
      throw new HttpException(
        {
          error: 'INSUFFICIENT_CREDITS',
          message: `Necesitás ${creditsNeeded} créditos pero solo tenés ${remaining}`,
          creditsNeeded,
          creditsAvailable: remaining === Infinity ? null : remaining,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const bucket = this.r2Service.bucketAvatars();
    let userPhotoUrl: string;

    if (userPhoto) {
      // New upload — persist as TryOnBasePhoto and use it
      const saved = await this.uploadBasePhoto(userId, userPhoto);
      const savedDoc = await this.basePhotoModel.findById(saved.id).lean();
      userPhotoUrl = savedDoc
        ? this.r2Service.getPublicUrl(bucket, savedDoc.r2Key)
        : saved.url;
    } else {
      // Reuse existing base photo
      if (!Types.ObjectId.isValid(basePhotoId!)) {
        throw new BadRequestException({ error: 'INVALID_ID', field: 'basePhotoId' });
      }
      const baseDoc = await this.basePhotoModel.findOne({
        _id: new Types.ObjectId(basePhotoId!),
        userId: new Types.ObjectId(userId),
      }).lean();
      if (!baseDoc) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Base photo not found.' });
      userPhotoUrl = this.r2Service.getPublicUrl(bucket, baseDoc.r2Key);
    }
    this.logger.log(`[tryon/outfit] Photo resolved: ${userPhotoUrl}`);

    const ORDER = ['bottom', 'dress', 'top', 'outerwear'];
    const sorted = [...garments].sort(
      (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category),
    );

    let currentImageUrl = userPhotoUrl;
    let creditsUsed = 0;

    for (const g of sorted) {
      const garment = await this.wardrobeModel.findOne({
        _id: new Types.ObjectId(g.garmentId),
        userId: new Types.ObjectId(userId),
      }).lean();

      if (!garment) throw new NotFoundException(`Garment ${g.garmentId} not found`);

      const vtonCategory = mapCategoryToVton(garment.category || g.category);
      const garmentDes = buildGarmentDes(garment);
      const garmentUrl = garment.imageProcessedUrl ?? garment.imageUrl;

      this.logger.log(`[tryon/outfit] Processing garment=${g.garmentId} category=${vtonCategory} des="${garmentDes}"`);

      try {
        const result = await this.aiService.tryon(currentImageUrl, [garmentUrl], garmentDes, vtonCategory);
        currentImageUrl = result.resultUrl;
        creditsUsed++;
        await this.subscriptionsService.decrementTryonCredit(userId);
        this.logger.log(`[tryon/outfit] Garment ${g.garmentId} done. creditsUsed=${creditsUsed}`);
      } catch (err) {
        this.logger.error(`[tryon/outfit] Garment ${g.garmentId} failed: ${(err as Error).message}`);
        throw new InternalServerErrorException(`El try-on de la prenda ${g.garmentId} falló. Intentá de nuevo.`);
      }
    }

    if (outfitId) {
      this.logger.log(`[tryon/outfit] Saving result to outfitId=${outfitId}`);
    }

    this.logger.log(`[tryon/outfit] Done. creditsUsed=${creditsUsed} resultUrl=${currentImageUrl}`);
    return { resultImageUrl: currentImageUrl, creditsUsed };
  }

  // --- Base photos ---

  private async serializeBasePhoto(doc: TryOnBasePhotoDocument): Promise<{
    id: string;
    url: string;
    createdAt: Date;
  }> {
    const bucket = this.r2Service.bucketAvatars();
    const url = await this.r2Service.getSignedReadUrl(bucket, doc.r2Key, 3600);
    return { id: String(doc._id), url, createdAt: doc.createdAt };
  }

  async listBasePhotos(userId: string): Promise<{ photos: { id: string; url: string; createdAt: Date }[] }> {
    const docs = await this.basePhotoModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(BASE_PHOTOS_LIMIT)
      .lean();

    const photos = await Promise.all(
      docs.map((d) => this.serializeBasePhoto(d as TryOnBasePhotoDocument)),
    );
    return { photos };
  }

  async uploadBasePhoto(userId: string, file: Express.Multer.File): Promise<{ id: string; url: string; createdAt: Date }> {
    const { width, height } = await sharp(file.buffer).metadata();

    // FIFO: delete oldest if at limit
    const count = await this.basePhotoModel.countDocuments({ userId: new Types.ObjectId(userId) });
    if (count >= BASE_PHOTOS_LIMIT) {
      const oldest = await this.basePhotoModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: 1 })
        .lean();
      if (oldest) {
        await Promise.all([
          this.basePhotoModel.deleteOne({ _id: oldest._id }),
          this.r2Service.deleteObject(this.r2Service.bucketAvatars(), oldest.r2Key).catch(() => {}),
        ]);
      }
    }

    const bucket = this.r2Service.bucketAvatars();
    const r2Key = `users/${userId}/try-on-base-photos/${new Date().toISOString()}.jpg`;
    await this.r2Service.uploadStream(bucket, r2Key, file.buffer, file.mimetype);

    const doc = await this.basePhotoModel.create({
      userId: new Types.ObjectId(userId),
      r2Key,
      fileSize: file.size,
      width: width ?? 0,
      height: height ?? 0,
    });

    return this.serializeBasePhoto(doc);
  }

  async deleteBasePhoto(userId: string, photoId: string): Promise<void> {
    if (!Types.ObjectId.isValid(photoId)) throw new BadRequestException({ error: 'INVALID_ID' });

    const doc = await this.basePhotoModel.findOne({
      _id: new Types.ObjectId(photoId),
      userId: new Types.ObjectId(userId),
    }).lean();
    if (!doc) throw new NotFoundException({ error: 'NOT_FOUND' });

    await Promise.all([
      this.basePhotoModel.deleteOne({ _id: doc._id }),
      this.r2Service.deleteObject(this.r2Service.bucketAvatars(), doc.r2Key).catch(() => {}),
    ]);
  }
}
