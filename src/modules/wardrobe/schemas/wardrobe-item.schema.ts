import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WardrobeItemDocument = HydratedDocument<WardrobeItem>;

export type WardrobeItemStatus = 'processing' | 'ready' | 'failed';

@Schema({ timestamps: true })
export class WardrobeItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  imageUrl!: string;

  @Prop()
  imageProcessedUrl?: string;

  @Prop({ default: '' })
  name!: string;

  @Prop({ default: '' })
  type!: string;

  @Prop({ default: '' })
  category!: string;

  @Prop({ default: '' })
  color!: string;

  @Prop()
  material?: string;

  @Prop()
  brand?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: 0 })
  aiConfidence!: number;

  @Prop({ enum: ['processing', 'ready', 'failed'], default: 'processing' })
  status!: WardrobeItemStatus;

  @Prop({ default: false })
  archived!: boolean;
}

export const WardrobeItemSchema = SchemaFactory.createForClass(WardrobeItem);
WardrobeItemSchema.index({ userId: 1, archived: 1, createdAt: -1 });
WardrobeItemSchema.index({ userId: 1, category: 1, color: 1 });
