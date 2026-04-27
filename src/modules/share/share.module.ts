import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { Outfit, OutfitSchema } from '../outfits/schemas/outfit.schema';
import { WardrobeItem, WardrobeItemSchema } from '../wardrobe/schemas/wardrobe-item.schema';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Outfit.name, schema: OutfitSchema },
      { name: WardrobeItem.name, schema: WardrobeItemSchema },
    ]),
    StorageModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [ShareController],
  providers: [ShareService],
})
export class ShareModule {}
