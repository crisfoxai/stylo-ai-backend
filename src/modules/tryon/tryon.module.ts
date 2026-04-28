import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TryonController } from './tryon.controller';
import { TryonService } from './tryon.service';
import { TryonResult, TryonResultSchema } from './schemas/tryon-result.schema';
import { TryOnBasePhoto, TryOnBasePhotoSchema } from './schemas/tryon-base-photo.schema';
import { WardrobeItem, WardrobeItemSchema } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TryonResult.name, schema: TryonResultSchema },
      { name: TryOnBasePhoto.name, schema: TryOnBasePhotoSchema },
      { name: WardrobeItem.name, schema: WardrobeItemSchema },
    ]),
    AIModule,
    StorageModule,
    AuthModule,
    SubscriptionsModule,
  ],
  controllers: [TryonController],
  providers: [TryonService],
  exports: [TryonService],
})
export class TryonModule {}
