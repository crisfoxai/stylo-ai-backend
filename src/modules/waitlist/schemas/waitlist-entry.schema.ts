import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WaitlistEntryDocument = HydratedDocument<WaitlistEntry>;

@Schema({ timestamps: true })
export class WaitlistEntry {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop()
  locale?: string;

  @Prop()
  source?: string;
}

export const WaitlistEntrySchema = SchemaFactory.createForClass(WaitlistEntry);
WaitlistEntrySchema.index({ email: 1 }, { unique: true });
