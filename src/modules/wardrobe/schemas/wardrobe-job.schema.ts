import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WardrobeJobDocument = HydratedDocument<WardrobeJob>;

export type WardrobeJobStatus = 'processing' | 'done' | 'failed';

@Schema({ timestamps: true, collection: 'wardrobe_jobs' })
export class WardrobeJob {
  @Prop({ required: true, index: true })
  jobId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ enum: ['processing', 'done', 'failed'], default: 'processing' })
  status!: WardrobeJobStatus;

  @Prop({ type: Types.ObjectId, ref: 'WardrobeItem' })
  garmentId?: Types.ObjectId;

  @Prop()
  error?: string;
}

export const WardrobeJobSchema = SchemaFactory.createForClass(WardrobeJob);
WardrobeJobSchema.index({ jobId: 1, userId: 1 });
