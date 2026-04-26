import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum FeedbackType {
  LIKE = 'like',
  DISLIKE = 'dislike',
}

@Schema({ timestamps: true, collection: 'feedback' })
export class Feedback {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Outfit', required: true })
  outfitId!: Types.ObjectId;

  @Prop({ type: String, enum: FeedbackType, required: true })
  type!: FeedbackType;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
FeedbackSchema.index({ userId: 1, outfitId: 1 }, { unique: true });
FeedbackSchema.index({ outfitId: 1, type: 1 });
