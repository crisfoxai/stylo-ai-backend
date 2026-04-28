import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PurchaseHistoryDocument = HydratedDocument<PurchaseHistory>;

@Schema({ timestamps: true })
export class PurchaseHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  transactionId!: string;

  @Prop({ enum: ['ios', 'android'], required: true })
  platform!: 'ios' | 'android';

  @Prop({ required: true })
  productId!: string;

  @Prop({ required: true })
  planName!: string;

  @Prop({ enum: ['monthly', 'annual'], required: true })
  billingPeriod!: 'monthly' | 'annual';

  @Prop({ required: true })
  amountPaid!: number;

  @Prop({ default: 'USD' })
  currency!: string;

  @Prop({ required: true })
  purchaseDate!: Date;

  @Prop({ required: true })
  expiresDate!: Date;

  @Prop({ enum: ['active', 'expired', 'refunded', 'cancelled'], required: true })
  status!: string;

  @Prop({ default: false })
  isTrialPeriod!: boolean;

  @Prop({ default: false })
  isRenewal!: boolean;
}

export const PurchaseHistorySchema = SchemaFactory.createForClass(PurchaseHistory);
PurchaseHistorySchema.index({ userId: 1, purchaseDate: -1 });
PurchaseHistorySchema.index({ transactionId: 1 }, { unique: true });
