import { Injectable, Logger, NotFoundException, UnprocessableEntityException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import { Outfit, OutfitDocument } from '../outfits/schemas/outfit.schema';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { R2Service } from '../storage/r2.service';
import { UsersService } from '../users/users.service';
import { ShareCardResponseDto } from './dto/share-card.dto';

const DAILY_LIMIT = 3;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);
  private readonly dailyCount = new Map<string, { date: string; count: number }>();

  constructor(
    @InjectModel(Outfit.name) private readonly outfitModel: Model<OutfitDocument>,
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
    private readonly r2Service: R2Service,
    private readonly usersService: UsersService,
  ) {}

  async generateShareCard(userId: string, outfitId: string): Promise<ShareCardResponseDto> {
    this.checkDailyLimit(userId);

    const outfit = await this.outfitModel.findOne({
      _id: new Types.ObjectId(outfitId),
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });
    if (!outfit.items || outfit.items.length < 2) {
      throw new UnprocessableEntityException({ error: 'NOT_ENOUGH_GARMENTS' });
    }

    const user = await this.usersService.findById(userId);
    const referralCode = (user as unknown as { referralCode?: string }).referralCode
      ?? userId.slice(-6).toUpperCase();

    const garmentIds = outfit.items.map((i) => i.wardrobeItemId);
    const garments = await this.itemModel
      .find({ _id: { $in: garmentIds } })
      .lean();

    const [userPhotoBuffer, garmentBuffers] = await Promise.all([
      this.downloadBuffer((user as unknown as { photoUrl?: string }).photoUrl),
      Promise.all(
        garments.slice(0, 4).map((g) =>
          this.downloadBuffer(
            (g.imageProcessedUrl || g.imageUrl) as string | undefined,
          ),
        ),
      ),
    ]);

    const card = await this.composeCard({
      userPhotoBuffer,
      garmentBuffers: garmentBuffers.filter(Boolean) as Buffer[],
      outfitName: (outfit as Record<string, unknown>).name as string | undefined ?? 'Mi Outfit',
      referralCode,
    });

    const bucket = this.r2Service.bucketWardrobe();
    const key = `share-cards/${userId}/${outfitId}-${Date.now()}.jpg`;
    const expiresAt = new Date(Date.now() + TTL_MS);

    await this.r2Service.uploadStream(bucket, key, card, 'image/jpeg', {
      expiresAt: expiresAt.toISOString(),
    });

    const url = this.r2Service.getPublicUrl(bucket, key);
    this.incrementDailyCount(userId);

    return { url, expiresAt: expiresAt.toISOString(), outfitId };
  }

  private checkDailyLimit(userId: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.dailyCount.get(userId);
    if (entry && entry.date === today && entry.count >= DAILY_LIMIT) {
      throw new HttpException({ error: 'DAILY_LIMIT_EXCEEDED', limit: DAILY_LIMIT }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private incrementDailyCount(userId: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.dailyCount.get(userId);
    if (entry && entry.date === today) {
      entry.count++;
    } else {
      this.dailyCount.set(userId, { date: today, count: 1 });
    }
  }

  private async downloadBuffer(url: string | undefined): Promise<Buffer | null> {
    if (!url || url.startsWith('https://mock-storage/')) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private async composeCard(params: {
    userPhotoBuffer: Buffer | null;
    garmentBuffers: Buffer[];
    outfitName: string;
    referralCode: string;
  }): Promise<Buffer> {
    const { userPhotoBuffer, garmentBuffers, outfitName, referralCode } = params;
    const W = 1080, H = 1350;
    const PHOTO_H = 648;
    const GARMENT_H = 450;
    const FOOTER_H = 252;

    const layers: sharp.OverlayOptions[] = [];

    // Photo or placeholder
    if (userPhotoBuffer) {
      const photo = await sharp(userPhotoBuffer)
        .resize(W, PHOTO_H, { fit: 'cover', position: 'top' })
        .toBuffer();
      layers.push({ input: photo, top: 0, left: 0 });
    } else {
      const placeholder = await sharp({
        create: { width: W, height: PHOTO_H, channels: 4, background: '#1A1A2E' },
      }).png().toBuffer();
      layers.push({ input: placeholder, top: 0, left: 0 });
    }

    // Garment thumbnails
    const THUMB = 180, spacing = 20;
    const maxG = Math.min(garmentBuffers.length, 4);
    const totalW = maxG * THUMB + (maxG - 1) * spacing;
    const startX = Math.floor((W - totalW) / 2);
    const thumbTop = PHOTO_H + Math.floor((GARMENT_H - THUMB) / 2);

    for (let i = 0; i < maxG; i++) {
      const thumb = await sharp(garmentBuffers[i])
        .resize(THUMB, THUMB, { fit: 'contain', background: '#FFFFFF' })
        .extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#FFFFFF' })
        .png()
        .toBuffer();
      layers.push({ input: thumb, top: thumbTop, left: startX + i * (THUMB + spacing) });
    }

    // Footer SVG
    const footerSvg = this.buildFooterSvg(W, FOOTER_H, referralCode, outfitName);
    const footerPng = await sharp(Buffer.from(footerSvg)).png().toBuffer();
    layers.push({ input: footerPng, top: PHOTO_H + GARMENT_H, left: 0 });

    const base = sharp({
      create: { width: W, height: H, channels: 4, background: '#FFFFFF' },
    });

    return base.composite(layers).jpeg({ quality: 88 }).toBuffer();
  }

  private buildFooterSvg(w: number, h: number, referralCode: string, outfitName: string): string {
    const safeName = outfitName.replace(/[<>&"]/g, '');
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#0D0D1A"/>
    <text x="${w / 2}" y="60" font-family="Inter, sans-serif" font-size="28" fill="#C8A96E"
      text-anchor="middle" font-weight="600">${safeName}</text>
    <text x="${w / 2}" y="110" font-family="Inter, sans-serif" font-size="22" fill="#FFFFFF99"
      text-anchor="middle">stylo.ai/join/${referralCode}</text>
    <text x="${w / 2}" y="180" font-family="Inter, sans-serif" font-size="40" fill="#FFFFFF"
      text-anchor="middle" font-weight="700" letter-spacing="6">STYLO AI</text>
    <text x="${w / 2}" y="220" font-family="Inter, sans-serif" font-size="20" fill="#FFFFFF66"
      text-anchor="middle">Tu estilista personal con IA</text>
  </svg>`;
  }
}
