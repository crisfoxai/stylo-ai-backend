import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutfitsController } from './outfits.controller';
import { OutfitsService } from './outfits.service';
import { OutfitsGenerator } from './outfits.generator';
import { Outfit, OutfitSchema } from './schemas/outfit.schema';
import { FavoriteOutfit, FavoriteOutfitSchema } from './schemas/favorite-outfit.schema';
import { WornEntry, WornEntrySchema } from './schemas/worn-entry.schema';
import { WardrobeItem, WardrobeItemSchema } from '../wardrobe/schemas/wardrobe-item.schema';
import { WeatherModule } from '../weather/weather.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Outfit.name, schema: OutfitSchema },
      { name: FavoriteOutfit.name, schema: FavoriteOutfitSchema },
      { name: WornEntry.name, schema: WornEntrySchema },
      { name: WardrobeItem.name, schema: WardrobeItemSchema },
    ]),
    WeatherModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [OutfitsController],
  providers: [OutfitsService, OutfitsGenerator],
  exports: [OutfitsService],
})
export class OutfitsModule {}
