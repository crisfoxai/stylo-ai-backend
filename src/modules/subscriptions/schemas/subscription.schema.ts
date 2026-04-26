import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ enum: ['free', 'stylist', 'pro', 'pro_unlimited'], default: 'free' })
  plan!: string;

  @Prop({ enum: ['active', 'free', 'grace', 'expired', 'cancelled', 'pending'], default: 'free' })
  status!: string;

  @Prop({ enum: ['apple', 'google', 'none'], default: 'none' })
  platform!: string;

  @Prop({ default: '' })
  productId?: string;

  @Prop()
  originalTransactionId?: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: 0 })
  tryonUsedThisMonth!: number;

  @Prop({ default: 0 })
  chatMessagesUsedThisMonth!: number;

  @Prop()
  periodStart?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ userId: 1 }, { unique: true });
