import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StyleProfileDocument = HydratedDocument<StyleProfile>;

@Schema({ timestamps: false })
export class StyleProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  preferredStyles!: string[];

  @Prop({ type: [String], default: [] })
  preferredColors!: string[];

  @Prop({ type: [String], default: [] })
  commonOccasions!: string[];

  @Prop({ type: Object, default: {} })
  quizAnswers!: Record<string, unknown>;

  @Prop({ default: () => new Date() })
  updatedAt!: Date;
}

export const StyleProfileSchema = SchemaFactory.createForClass(StyleProfile);
StyleProfileSchema.index({ userId: 1 }, { unique: true });
