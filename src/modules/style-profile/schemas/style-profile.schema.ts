import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StyleProfileDocument = HydratedDocument<StyleProfile>;

export enum StyleTag {
  CASUAL = 'casual',
  FORMAL = 'formal',
  SPORTY = 'sporty',
  BOHEMIAN = 'bohemian',
  MINIMALIST = 'minimalist',
  STREETWEAR = 'streetwear',
  VINTAGE = 'vintage',
  PREPPY = 'preppy',
  ROMANTIC = 'romantic',
  EDGY = 'edgy',
}

export enum Occasion {
  WORK = 'work',
  CASUAL = 'casual',
  DATE = 'date',
  FORMAL = 'formal',
  SPORT = 'sport',
  TRAVEL = 'travel',
  PARTY = 'party',
}

@Schema({ timestamps: true, collection: 'style_profiles' })
export class StyleProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], enum: StyleTag, default: [] })
  styles!: StyleTag[];

  @Prop({ type: [String], default: [] })
  colors!: string[];

  @Prop({ type: [String], enum: Occasion, default: [] })
  occasions!: Occasion[];

  @Prop({ min: 1, max: 5, default: 3 })
  adventureLevel!: number;

  @Prop({ type: [String], default: [] })
  priorities!: string[];

  @Prop({ default: false })
  quizCompleted!: boolean;
}

export const StyleProfileSchema = SchemaFactory.createForClass(StyleProfile);
StyleProfileSchema.index({ userId: 1 }, { unique: true });
