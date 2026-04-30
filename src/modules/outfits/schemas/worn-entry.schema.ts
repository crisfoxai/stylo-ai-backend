import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WornEntryDocument = HydratedDocument<WornEntry>;

@Schema({ timestamps: false })
export class WornEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Outfit', required: true })
  outfitId!: Types.ObjectId;

  @Prop({ required: true })
  wornDate!: Date;
}

export const WornEntrySchema = SchemaFactory.createForClass(WornEntry);
WornEntrySchema.index({ userId: 1, wornDate: -1 });
WornEntrySchema.index({ userId: 1, outfitId: 1 });
