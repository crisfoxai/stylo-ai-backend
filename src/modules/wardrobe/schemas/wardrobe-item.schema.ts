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

  @Prop({ type: String, default: null })
  colorSecondary!: string | null;

  @Prop({ type: [String], default: [] })
  materials!: string[];

  @Prop({ type: String, default: null })
  style!: string | null;

  @Prop({ type: String, default: null })
  fit!: string | null;

  @Prop({ type: [String], default: [] })
  seasons!: string[];

  @Prop({ type: [String], default: [] })
  occasions!: string[];

  @Prop({ type: String, default: null })
  condition!: string | null;

  @Prop({ type: Number, default: null })
  purchasePrice!: number | null;

  @Prop({ type: Date, default: null })
  purchaseDate!: Date | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export const WardrobeItemSchema = SchemaFactory.createForClass(WardrobeItem);
WardrobeItemSchema.index({ userId: 1, archived: 1, createdAt: -1 });
WardrobeItemSchema.index({ userId: 1, category: 1, color: 1 });
WardrobeItemSchema.index({ status: 1, archived: 1 });
WardrobeItemSchema.index({ userId: 1, status: 1 });
