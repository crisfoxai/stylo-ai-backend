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
import { TryonResult, TryonResultDocument } from './schemas/tryon-result.schema';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TryonOutfitDto } from './dto/tryon.dto';

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
    dto: TryonOutfitDto,
  ): Promise<{ resultImageUrl: string; creditsUsed: number }> {
    this.logger.log(`[tryon/outfit] userId=${userId} garments=${JSON.stringify(dto.garments)}`);

    if (!dto.garments?.length) {
      throw new BadRequestException('Debés seleccionar al menos una prenda.');
    }

    for (const g of dto.garments) {
      const normalized = (g.category ?? '').toLowerCase().replace(/[-_\s]/g, '');
      if (!CATEGORY_MAP[normalized]) {
        throw new BadRequestException(
          `Categoría no soportada para try-on: ${g.category}. Soportadas: top, bottom, outerwear, dress (y aliases comunes).`,
        );
      }
    }

    const creditsNeeded = dto.garments.length;
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

    const ORDER = ['bottom', 'dress', 'top', 'outerwear'];
    const sorted = [...dto.garments].sort(
      (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category),
    );

    let currentImageUrl = dto.userPhotoUrl;
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

    if (dto.outfitId) {
      this.logger.log(`[tryon/outfit] Saving result to outfitId=${dto.outfitId}`);
    }

    this.logger.log(`[tryon/outfit] Done. creditsUsed=${creditsUsed} resultUrl=${currentImageUrl}`);
    return { resultImageUrl: currentImageUrl, creditsUsed };
  }
}
