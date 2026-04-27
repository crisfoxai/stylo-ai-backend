import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReferralDocument = HydratedDocument<Referral>;

@Schema({ timestamps: true })
export class Referral {
  @Prop({ required: true, index: true })
  referrerId!: string;

  @Prop({ required: true, index: true })
  referredUserId!: string;

  @Prop({ required: true })
  referralCode!: string;

  @Prop({ enum: ['pending', 'validated', 'rejected', 'credited'], default: 'pending', index: true })
  status!: string;

  @Prop({ default: null })
  purchaseValidatedAt?: Date | null;

  @Prop({ default: null })
  creditedAt?: Date | null;

  @Prop({ default: null })
  rejectedReason?: string | null;

  @Prop({ default: null })
  deviceFingerprint?: string | null;

  createdAt!: Date;
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);
ReferralSchema.index({ referrerId: 1 });
ReferralSchema.index({ referredUserId: 1 });
ReferralSchema.index({ status: 1, createdAt: 1 });
ReferralSchema.index({ referralCode: 1 });
