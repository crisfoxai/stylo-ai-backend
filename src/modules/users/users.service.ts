import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, HydratedDocument } from 'mongoose';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { StyleProfileService } from '../style-profile/style-profile.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { R2Service } from '../storage/r2.service';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { WardrobeJob, WardrobeJobDocument } from '../wardrobe/schemas/wardrobe-job.schema';
import { Outfit, OutfitDocument } from '../outfits/schemas/outfit.schema';
import { WornEntry, WornEntryDocument } from '../outfits/schemas/worn-entry.schema';
import { FavoriteOutfit, FavoriteOutfitDocument } from '../outfits/schemas/favorite-outfit.schema';
import { TryonResult, TryonResultDocument } from '../tryon/schemas/tryon-result.schema';
import { Subscription, SubscriptionDocument } from '../subscriptions/schemas/subscription.schema';
import { PushToken, PushTokenDocument } from '../notifications/schemas/push-token.schema';
import { Favorite } from '../favorites/schemas/favorite.schema';
import { StyleProfile, StyleProfileDocument } from '../style-profile/schemas/style-profile.schema';
import { getFirebaseApp } from '../../config/firebase.config';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(WardrobeItem.name) private readonly wardrobeItemModel: Model<WardrobeItemDocument>,
    @InjectModel(WardrobeJob.name) private readonly wardrobeJobModel: Model<WardrobeJobDocument>,
    @InjectModel(Outfit.name) private readonly outfitModel: Model<OutfitDocument>,
    @InjectModel(WornEntry.name) private readonly wornEntryModel: Model<WornEntryDocument>,
    @InjectModel(FavoriteOutfit.name) private readonly favoriteOutfitModel: Model<FavoriteOutfitDocument>,
    @InjectModel(TryonResult.name) private readonly tryonResultModel: Model<TryonResultDocument>,
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(PushToken.name) private readonly pushTokenModel: Model<PushTokenDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<HydratedDocument<Favorite>>,
    @InjectModel(StyleProfile.name) private readonly styleProfileModel: Model<StyleProfileDocument>,
    private readonly styleProfileService: StyleProfileService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly r2Service: R2Service,
    private readonly configService: ConfigService,
  ) {}

  async findById(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException({ error: 'NOT_FOUND' });
    return user as UserDocument;
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .lean();
    if (!user) throw new NotFoundException({ error: 'NOT_FOUND' });
    return user as UserDocument;
  }

  async getStyleProfile(userId: string) {
    try {
      return await this.styleProfileService.findByUser(userId);
    } catch {
      return null;
    }
  }

  async getTryonStats(userId: string) {
    return this.subscriptionsService.getTryonStats(userId);
  }

  async hardDelete(userId: string, firebaseUid: string): Promise<void> {
    const oid = new Types.ObjectId(userId);

    // Delete all user data from MongoDB in parallel
    await Promise.all([
      this.userModel.deleteOne({ _id: oid }),
      this.wardrobeItemModel.deleteMany({ userId: oid }),
      this.wardrobeJobModel.deleteMany({ userId: oid }),
      this.outfitModel.deleteMany({ userId: oid }),
      this.wornEntryModel.deleteMany({ userId: oid }),
      this.favoriteOutfitModel.deleteMany({ userId: oid }),
      this.tryonResultModel.deleteMany({ userId: oid }),
      this.subscriptionModel.deleteMany({ userId: oid }),
      this.pushTokenModel.deleteMany({ userId: oid }),
      this.favoriteModel.deleteMany({ userId: oid }),
      this.styleProfileModel.deleteOne({ userId: oid }),
    ]);

    this.logger.log(`[hardDelete] MongoDB data deleted for userId=${userId}`);

    // Delete R2 files — best-effort (log and continue on failure)
    const r2Deletions = [
      { bucket: this.r2Service.bucketWardrobe(), prefix: `${userId}/` },
      { bucket: this.r2Service.bucketTryon(), prefix: `tryon/${userId}/` },
      { bucket: this.r2Service.bucketAvatars(), prefix: `tryon/${userId}/` },
    ];
    await Promise.all(
      r2Deletions.map(({ bucket, prefix }) =>
        this.r2Service.deleteByPrefix(bucket, prefix).catch((err: Error) =>
          this.logger.warn(`[hardDelete] R2 deleteByPrefix ${bucket}/${prefix} failed: ${err.message}`),
        ),
      ),
    );

    // Delete Firebase Auth user — best-effort
    try {
      const firebaseApp = getFirebaseApp(this.configService);
      await (firebaseApp.auth() as admin.auth.Auth).deleteUser(firebaseUid);
      this.logger.log(`[hardDelete] Firebase user deleted uid=${firebaseUid}`);
    } catch (err) {
      this.logger.warn(`[hardDelete] Firebase deleteUser failed (uid=${firebaseUid}): ${(err as Error).message}`);
    }
  }
}
