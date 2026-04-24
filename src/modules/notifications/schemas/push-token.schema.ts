import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PushTokenDocument = HydratedDocument<PushToken>;

@Schema({ timestamps: false })
export class PushToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, enum: ['ios', 'android'] })
  platform!: string;

  @Prop({ default: () => new Date() })
  updatedAt!: Date;
}

export const PushTokenSchema = SchemaFactory.createForClass(PushToken);
PushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
