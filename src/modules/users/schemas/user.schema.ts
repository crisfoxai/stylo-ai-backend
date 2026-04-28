import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class NotificationPreferences {
  @Prop({ default: true }) global!: boolean;
  @Prop({ default: true }) outfitsDaily!: boolean;
  @Prop({ default: true }) outfitsOccasion!: boolean;
  @Prop({ default: false }) outfitsWeekly!: boolean;
  @Prop({ default: true }) tryOn!: boolean;
  @Prop({ default: true }) referrals!: boolean;
  @Prop({ default: true }) subscription!: boolean;
  @Prop({ default: false }) wardrobeInsights!: boolean;
}

@Schema({ timestamps: false })
export class User {
  @Prop({ required: true, unique: true, index: true })
  firebaseUid!: string;

  @Prop({ required: true, unique: true, sparse: true })
  email!: string;

  @Prop({ default: '' })
  displayName!: string;

  @Prop({ default: '' })
  photoUrl!: string;

  @Prop({ default: () => new Date() })
  createdAt!: Date;

  @Prop()
  deletedAt?: Date;

  @Prop({ default: () => Math.random().toString(36).slice(2, 8).toUpperCase(), unique: true, sparse: true })
  referralCode!: string;

  @Prop({ type: String, default: null })
  referredBy?: string | null;

  @Prop({ type: String, default: null })
  referredByCode?: string | null;

  @Prop({ type: Date, default: null })
  premiumAccessUntil?: Date | null;

  @Prop({ type: NotificationPreferences, default: () => ({}) })
  notificationPreferences!: NotificationPreferences;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ firebaseUid: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
