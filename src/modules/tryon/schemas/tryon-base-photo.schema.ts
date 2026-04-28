import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TryOnBasePhotoDocument = HydratedDocument<TryOnBasePhoto>;

@Schema({ timestamps: true })
export class TryOnBasePhoto {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  r2Key!: string;

  @Prop({ required: true })
  fileSize!: number;

  @Prop({ required: true })
  width!: number;

  @Prop({ required: true })
  height!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TryOnBasePhotoSchema = SchemaFactory.createForClass(TryOnBasePhoto);
TryOnBasePhotoSchema.index({ userId: 1, createdAt: -1 });
