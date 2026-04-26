import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ enum: ['user', 'assistant'], required: true })
  role!: string;

  @Prop({ required: true })
  content!: string;

  @Prop()
  model?: string;

  @Prop({ required: true })
  sessionId!: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });
ChatMessageSchema.index({ userId: 1, createdAt: -1 });
