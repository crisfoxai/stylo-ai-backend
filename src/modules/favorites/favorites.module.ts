import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Favorite.name, schema: FavoriteSchema }]), AuthModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
