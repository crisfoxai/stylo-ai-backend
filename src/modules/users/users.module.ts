import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { StyleProfileModule } from '../style-profile/style-profile.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StorageModule } from '../storage/storage.module';
import { WardrobeItem, WardrobeItemSchema } from '../wardrobe/schemas/wardrobe-item.schema';
import { WardrobeJob, WardrobeJobSchema } from '../wardrobe/schemas/wardrobe-job.schema';
import { Outfit, OutfitSchema } from '../outfits/schemas/outfit.schema';
import { WornEntry, WornEntrySchema } from '../outfits/schemas/worn-entry.schema';
import { FavoriteOutfit, FavoriteOutfitSchema } from '../outfits/schemas/favorite-outfit.schema';
import { TryonResult, TryonResultSchema } from '../tryon/schemas/tryon-result.schema';
import { TryOnBasePhoto, TryOnBasePhotoSchema } from '../tryon/schemas/tryon-base-photo.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import { PushToken, PushTokenSchema } from '../notifications/schemas/push-token.schema';
import { Favorite, FavoriteSchema } from '../favorites/schemas/favorite.schema';
import { StyleProfile, StyleProfileSchema } from '../style-profile/schemas/style-profile.schema';
import { PurchaseHistory, PurchaseHistorySchema } from '../subscriptions/schemas/purchase-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: WardrobeItem.name, schema: WardrobeItemSchema },
      { name: WardrobeJob.name, schema: WardrobeJobSchema },
      { name: Outfit.name, schema: OutfitSchema },
      { name: WornEntry.name, schema: WornEntrySchema },
      { name: FavoriteOutfit.name, schema: FavoriteOutfitSchema },
      { name: TryonResult.name, schema: TryonResultSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: PushToken.name, schema: PushTokenSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: StyleProfile.name, schema: StyleProfileSchema },
      { name: PurchaseHistory.name, schema: PurchaseHistorySchema },
      { name: TryOnBasePhoto.name, schema: TryOnBasePhotoSchema },
    ]),
    AuthModule,
    StyleProfileModule,
    SubscriptionsModule,
    StorageModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
