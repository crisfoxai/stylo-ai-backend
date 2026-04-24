import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ enum: ['free', 'premium'], default: 'free' })
  plan!: string;

  @Prop({ enum: ['active', 'free', 'grace', 'expired', 'cancelled', 'pending'], default: 'free' })
  status!: string;

  @Prop({ enum: ['apple', 'google', 'none'], default: 'none' })
  platform!: string;

  @Prop()
  originalTransactionId?: string;

  @Prop()
  expiresAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ userId: 1 }, { unique: true });
