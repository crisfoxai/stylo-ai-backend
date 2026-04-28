import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OutfitPreviewDocument = HydratedDocument<OutfitPreview>;

@Schema({ timestamps: true })
export class OutfitPreview {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [Object], required: true })
  garments!: any[];

  @Prop()
  justification?: string;

  @Prop({ type: [Object], default: [] })
  items!: { wardrobeItemId: Types.ObjectId; slot: string }[];

  @Prop({ default: '' })
  aiModel!: string;

  @Prop({ type: [String], default: [] })
  contextFactors!: string[];

  @Prop({ type: Object, default: null })
  weatherContext?: unknown;

  @Prop()
  occasion?: string;

  @Prop()
  mood?: string;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;
}

export const OutfitPreviewSchema = SchemaFactory.createForClass(OutfitPreview);

// TTL index: MongoDB deletes the doc when now > expiresAt
OutfitPreviewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
