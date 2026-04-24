import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteOutfitDocument = HydratedDocument<FavoriteOutfit>;

@Schema({ timestamps: true })
export class FavoriteOutfit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Outfit', required: true })
  outfitId!: Types.ObjectId;
}

export const FavoriteOutfitSchema = SchemaFactory.createForClass(FavoriteOutfit);
FavoriteOutfitSchema.index({ userId: 1, outfitId: 1 }, { unique: true });
