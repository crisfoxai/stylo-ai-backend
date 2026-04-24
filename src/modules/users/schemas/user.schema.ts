import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ firebaseUid: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
