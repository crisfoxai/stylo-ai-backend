import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiUsageLogDocument = HydratedDocument<AiUsageLog>;

@Schema({ timestamps: true })
export class AiUsageLog {
  @Prop({ type: Types.ObjectId, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true })
  endpoint!: string;

  @Prop({ default: 0 })
  inputTokens!: number;

  @Prop({ default: 0 })
  outputTokens!: number;

  @Prop({ default: 0 })
  estimatedCostUSD!: number;

  @Prop()
  durationMs?: number;
}

export const AiUsageLogSchema = SchemaFactory.createForClass(AiUsageLog);

AiUsageLogSchema.index({ userId: 1, createdAt: -1 });
AiUsageLogSchema.index({ createdAt: -1 });
AiUsageLogSchema.index({ provider: 1, createdAt: -1 });
