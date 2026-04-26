import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TryonResultDocument = HydratedDocument<TryonResult>;

@Schema({ timestamps: true })
export class TryonResult {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Outfit' })
  outfitId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WardrobeItem' })
  garmentId?: Types.ObjectId;

  @Prop()
  cacheKey?: string;

  @Prop({ required: true })
  resultUrl!: string;
}

export const TryonResultSchema = SchemaFactory.createForClass(TryonResult);
TryonResultSchema.index({ userId: 1, createdAt: -1 });
TryonResultSchema.index({ userId: 1, cacheKey: 1 });
