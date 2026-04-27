import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OutfitDocument = HydratedDocument<Outfit>;

class WeatherContext {
  tempC!: number;
  condition!: string;
  lat!: number;
  lon!: number;
}

class OutfitItem {
  wardrobeItemId!: Types.ObjectId;
  slot!: string;
}

@Schema({ timestamps: true })
export class Outfit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  occasion!: string;

  @Prop()
  mood?: string;

  @Prop({ type: Object })
  weatherContext?: WeatherContext;

  @Prop({ type: [{ wardrobeItemId: Types.ObjectId, slot: String }], default: [] })
  items!: OutfitItem[];

  @Prop({ default: '' })
  aiModel!: string;

  @Prop({ default: '' })
  justification!: string;

  @Prop({ type: [String], default: [] })
  contextFactors!: string[];
}

export const OutfitSchema = SchemaFactory.createForClass(Outfit);
OutfitSchema.index({ userId: 1, createdAt: -1 });
